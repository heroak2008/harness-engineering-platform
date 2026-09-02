import { useEffect, useState } from 'react'
import axios from 'axios'
import { authHeaders } from '../utils/auth'
import { WIZARD_STEPS, DEFAULT_STAGE_TYPES, stageTypeLabel, getWorkflowProgress } from '../utils/workflowProgress'
import {
  COMMAND_NAME_PATTERN,
  normalizeCommandName,
  cliInvocation,
  compileCommandBody,
  findUnboundNodes
} from '../utils/commandPreview'
import './WorkflowWizard.css'

const PARAM_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/

const emptyStageDraft = { id: null, name: '', type: '场景理解', description: '' }
const emptyStepDraft = { stageId: null, id: null, name: '', description: '' }
const emptyCommandDraft = {
  id: null,
  name: '',
  description: '',
  parameters: '{\n  "input": "string"\n}',
  bodyOverride: '',
  customizeBody: false
}
const emptyQuickAsset = { name: '', assetType: 'Agent', description: '' }

function WorkflowWizard({ scenario, workflow, initialStep = 0, onClose }) {
  const [step, setStep] = useState(initialStep)
  const [maxReached, setMaxReached] = useState(initialStep)
  const [workflowId, setWorkflowId] = useState(workflow?._id || null)
  const [wf, setWf] = useState(workflow || null)
  const [assets, setAssets] = useState([])
  const [scenarioForm, setScenarioForm] = useState({
    name: scenario?.name || '',
    code: scenario?.code || '',
    description: scenario?.description || ''
  })
  const [workflowForm, setWorkflowForm] = useState({
    name: workflow?.name || '',
    description: workflow?.description || ''
  })
  const [stageDraft, setStageDraft] = useState(null)
  const [stepDraft, setStepDraft] = useState(null)
  const [commandDraft, setCommandDraft] = useState(null)
  // 场景的环节类型调色板（场景内自定义），新增/删除会持久化到 Scenario.stageTypes
  const [stageTypes, setStageTypes] = useState(scenario?.stageTypes?.length ? scenario.stageTypes : DEFAULT_STAGE_TYPES)
  const [newStageType, setNewStageType] = useState('')
  const [poolIds, setPoolIds] = useState(
    (workflow?.assets || []).map(item => item.assetId?._id || item.assetId).filter(Boolean)
  )
  // 节点资产分配：{ [nodeId]: [assetId, ...] }
  const [nodeAssetsMap, setNodeAssetsMap] = useState(() => {
    const map = {}
    ;(workflow?.stages || []).forEach(stage => {
      (stage.steps || []).forEach(node => {
        map[node.id] = (node.assets || [])
          .map(item => item.assetId?._id || item.assetId)
          .filter(Boolean)
      })
    })
    return map
  })
  const [quickAsset, setQuickAsset] = useState(null)
  const [poolSearch, setPoolSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAssets()
  }, [])

  const loadAssets = async () => {
    try {
      const response = await axios.get('/api/asset', { headers: authHeaders() })
      setAssets(response.data.filter(asset => ['Agent', 'Skill'].includes(asset.assetType)))
    } catch (err) {
      console.error('Failed to load assets:', err)
      setError('资产列表加载失败，请确认后端服务已启动')
    }
  }

  const refreshWorkflow = async (id = workflowId) => {
    if (!id) return
    const response = await axios.get(`/api/workflow/${id}`, { headers: authHeaders() })
    const fresh = response.data
    setWf(fresh)
    setPoolIds(fresh.assets.map(item => item.assetId?._id || item.assetId).filter(Boolean))
    const map = {}
    fresh.stages.forEach(stage => {
      (stage.steps || []).forEach(node => {
        map[node.id] = (node.assets || [])
          .map(item => item.assetId?._id || item.assetId)
          .filter(Boolean)
      })
    })
    setNodeAssetsMap(map)
  }

  // 环节/节点/命令/资产操作都要求 workflow 已落库；未创建时先创建
  const ensureWorkflow = async () => {
    if (workflowId) return workflowId
    if (!workflowForm.name.trim()) {
      throw new Error('请先填写 Workflow 名称')
    }
    const response = await axios.post('/api/workflow', {
      name: workflowForm.name,
      description: workflowForm.description,
      scenarioId: scenario._id,
      businessScenario: scenario.name,
      stages: []
    }, { headers: authHeaders() })
    setWorkflowId(response.data._id)
    await refreshWorkflow(response.data._id)
    return response.data._id
  }

  const runStep = async (action) => {
    setSaving(true)
    setError('')
    try {
      await action()
      return true
    } catch (err) {
      console.error('Wizard step failed:', err)
      setError(err.response?.data?.error || err.message || '操作失败，请重试')
      return false
    } finally {
      setSaving(false)
    }
  }

  const goToStep = (target) => {
    if (target === step) return
    if (target >= 2 && !workflowId) return
    if (target > maxReached) return
    setStageDraft(null)
    setStepDraft(null)
    setCommandDraft(null)
    setError('')
    setStep(target)
  }

  const handleNext = async () => {
    if (step === 0) {
      if (!scenarioForm.name.trim()) {
        setError('请填写场景名称')
        return
      }
      if (!scenarioForm.description.trim()) {
        setError('请填写场景说明与目标（此步骤的必填项）')
        return
      }
      const ok = await runStep(() => axios.put(`/api/scenario/${scenario._id}`, {
        name: scenarioForm.name,
        code: scenarioForm.code,
        description: scenarioForm.description
      }, { headers: authHeaders() }))
      if (!ok) return
    }

    if (step === 1) {
      if (!workflowForm.name.trim()) {
        setError('请填写 Workflow 名称')
        return
      }
      const isCreating = !workflowId
      const ok = await runStep(async () => {
        const id = await ensureWorkflow()
        await axios.put(`/api/workflow/${id}`, {
          name: workflowForm.name,
          description: workflowForm.description
        }, { headers: authHeaders() })
        await refreshWorkflow(id)
      })
      if (!ok) return
      if (isCreating) {
        // 刚创建完流程时停留在本步，让用户直接开始编排环节与节点
        setError('')
        return
      }
      // 进入下一步前校验编排完整性：至少一个环节，且每个环节都有节点
      const stages = wf?.stages || []
      if (stages.length === 0) {
        setError('请至少添加一个环节，并在环节内添加节点')
        return
      }
      const emptyStage = stages.find(stage => !(stage.steps?.length > 0))
      if (emptyStage) {
        setError(`环节「${emptyStage.name}」下还没有节点，请添加节点或删除该环节`)
        return
      }
    }

    if (step === 2) {
      if ((wf?.commands || []).length === 0) {
        setError('请至少设计一个 Command 入口')
        return
      }
    }

    if (step === 3) {
      let finalProgress = null
      const ok = await runStep(async () => {
        // 先保存资产池（后端会级联解绑被移出池的节点资产），再逐节点重写资产分配
        await axios.put(`/api/workflow/${workflowId}/assets`, {
          assetIds: poolIds
        }, { headers: authHeaders() })
        const pool = new Set(poolIds)
        for (const stage of wf?.stages || []) {
          for (const node of stage.steps || []) {
            const selected = (nodeAssetsMap[node.id] || []).filter(id => pool.has(id))
            const nodeAssets = selected.map(assetId => {
              const asset = assets.find(item => item._id === assetId)
              return { assetId, type: asset.assetType, role: `${node.name}执行资产` }
            })
            await axios.put(`/api/workflow/${workflowId}/stages/${stage.id}/steps/${node.id}`, {
              assets: nodeAssets
            }, { headers: authHeaders() })
          }
        }
        // 按四步完成度更新 Workflow 状态：全部完成 → 设计完成(active)，否则保持草稿
        const fresh = await axios.get(`/api/workflow/${workflowId}`, { headers: authHeaders() })
        finalProgress = getWorkflowProgress(
          { ...scenario, name: scenarioForm.name, description: scenarioForm.description },
          fresh.data
        )
        await axios.put(`/api/workflow/${workflowId}`, {
          status: finalProgress.allDone ? 'active' : 'draft'
        }, { headers: authHeaders() })
      })
      if (!ok) return
      // 保存成功但有步骤未完成：留在本步并明确告知缺什么，而不是关闭后让用户自己反查
      if (!finalProgress.allDone) {
        await refreshWorkflow()
        const missing = finalProgress.steps
          .filter(item => item.state !== 'done')
          .map(item => `${item.label}（${item.reason}）`)
          .join('；')
        setError(`已保存当前配置，但以下步骤尚未完成：${missing}`)
        return
      }
      onClose()
      return
    }

    setError('')
    setStep(step + 1)
    setMaxReached(Math.max(maxReached, step + 1))
  }

  // ---- 步 2：环节与节点编排 ----

  const saveStage = async (event) => {
    event.preventDefault()
    await runStep(async () => {
      const id = await ensureWorkflow()
      const payload = {
        name: stageDraft.name,
        type: stageDraft.type,
        description: stageDraft.description
      }
      if (stageDraft.id) {
        await axios.put(`/api/workflow/${id}/stages/${stageDraft.id}`, payload, { headers: authHeaders() })
      } else {
        await axios.post(`/api/workflow/${id}/stages`, payload, { headers: authHeaders() })
      }
      await refreshWorkflow(id)
    })
    setStageDraft(null)
  }

  const deleteStage = async (stage) => {
    const nodeCount = stage.steps?.length || 0
    if (nodeCount > 0 && !window.confirm(`环节「${stage.name}」下有 ${nodeCount} 个节点，删除环节会一并删除这些节点。确认删除？`)) {
      return
    }
    await runStep(async () => {
      await axios.delete(`/api/workflow/${workflowId}/stages/${stage.id}`, { headers: authHeaders() })
      await refreshWorkflow()
    })
  }

  const moveStage = async (stageId, direction) => {
    const ordered = [...(wf?.stages || [])].sort((a, b) => a.order - b.order)
    const index = ordered.findIndex(stage => stage.id === stageId)
    const swapWith = ordered[index + direction]
    if (!swapWith) return
    await runStep(async () => {
      await axios.put(`/api/workflow/${workflowId}/stages/${stageId}`, {
        order: swapWith.order
      }, { headers: authHeaders() })
      await axios.put(`/api/workflow/${workflowId}/stages/${swapWith.id}`, {
        order: ordered[index].order
      }, { headers: authHeaders() })
      await refreshWorkflow()
    })
  }

  const saveNode = async (event) => {
    event.preventDefault()
    await runStep(async () => {
      const payload = { name: stepDraft.name, description: stepDraft.description }
      const base = `/api/workflow/${workflowId}/stages/${stepDraft.stageId}/steps`
      if (stepDraft.id) {
        await axios.put(`${base}/${stepDraft.id}`, payload, { headers: authHeaders() })
      } else {
        await axios.post(base, payload, { headers: authHeaders() })
      }
      await refreshWorkflow()
    })
    setStepDraft(null)
  }

  const deleteNode = async (stageId, nodeId) => {
    await runStep(async () => {
      await axios.delete(`/api/workflow/${workflowId}/stages/${stageId}/steps/${nodeId}`, { headers: authHeaders() })
      await refreshWorkflow()
    })
  }

  const moveNode = async (stage, nodeId, direction) => {
    const ordered = [...(stage.steps || [])].sort((a, b) => a.order - b.order)
    const index = ordered.findIndex(node => node.id === nodeId)
    const swapWith = ordered[index + direction]
    if (!swapWith) return
    await runStep(async () => {
      await axios.put(`/api/workflow/${workflowId}/stages/${stage.id}/steps/${nodeId}`, {
        order: swapWith.order
      }, { headers: authHeaders() })
      await axios.put(`/api/workflow/${workflowId}/stages/${stage.id}/steps/${swapWith.id}`, {
        order: ordered[index].order
      }, { headers: authHeaders() })
      await refreshWorkflow()
    })
  }

  // 向场景的环节类型调色板新增类型（持久化到 Scenario，后续该场景所有环节可选）
  const addStageType = async () => {
    const value = newStageType.trim()
    if (!value) return
    if (stageTypes.includes(value)) {
      setError('该环节类型已存在')
      return
    }
    const next = [...stageTypes, value]
    const ok = await runStep(() => axios.put(`/api/scenario/${scenario._id}`, {
      stageTypes: next
    }, { headers: authHeaders() }))
    if (ok) {
      setStageTypes(next)
      setNewStageType('')
      if (stageDraft) setStageDraft({ ...stageDraft, type: value })
    }
  }

  // 从调色板删除类型：已被环节使用的类型仅提示，不改动已有环节
  const removeStageType = async (type) => {
    const inUse = (wf?.stages || []).filter(stage => stage.type === type).length
    if (inUse > 0 && !window.confirm(`有 ${inUse} 个环节正在使用「${type}」，从调色板删除不会影响这些环节。确认删除？`)) {
      return
    }
    const next = stageTypes.filter(item => item !== type)
    const ok = await runStep(() => axios.put(`/api/scenario/${scenario._id}`, {
      stageTypes: next
    }, { headers: authHeaders() }))
    if (ok) setStageTypes(next)
  }

  // ---- 步 3：Command 入口 ----

  const parseCommandParameters = (raw) => {
    const parameters = raw.trim() ? JSON.parse(raw) : {}
    if (
      typeof parameters !== 'object' || Array.isArray(parameters) ||
      Object.entries(parameters).some(([key, value]) =>
        !PARAM_KEY_PATTERN.test(key) || typeof value !== 'string'
      )
    ) {
      throw new Error('参数定义必须是扁平 JSON 对象，key 为参数名、value 为类型说明字符串')
    }
    return parameters
  }

  const saveCommand = async (event) => {
    event.preventDefault()
    let parameters
    try {
      parameters = parseCommandParameters(commandDraft.parameters)
    } catch (err) {
      setError(err.message)
      return
    }
    const name = normalizeCommandName(commandDraft.name)
    if (!COMMAND_NAME_PATTERN.test(name)) {
      setError('Command 名称必须形如 /xxx，仅含小写字母、数字和连字符')
      return
    }
    const payload = {
      name,
      description: commandDraft.description,
      parameters,
      bodyOverride: commandDraft.customizeBody ? commandDraft.bodyOverride : ''
    }
    const ok = await runStep(async () => {
      if (commandDraft.id) {
        await axios.put(`/api/workflow/${workflowId}/commands/${commandDraft.id}`, payload, { headers: authHeaders() })
      } else {
        await axios.post(`/api/workflow/${workflowId}/commands`, payload, { headers: authHeaders() })
      }
      await refreshWorkflow()
    })
    if (ok) setCommandDraft(null)
  }

  const deleteCommand = async (commandId) => {
    await runStep(async () => {
      await axios.delete(`/api/workflow/${workflowId}/commands/${commandId}`, { headers: authHeaders() })
      await refreshWorkflow()
    })
  }

  // ---- 步 4：Skill / Agent 集成 ----

  const togglePoolAsset = (assetId) => {
    const removing = poolIds.includes(assetId)
    setPoolIds(removing ? poolIds.filter(id => id !== assetId) : [...poolIds, assetId])
    if (removing) {
      // 移出资产池时同步清掉各节点里的引用，避免提交时被后端拒绝
      setNodeAssetsMap(map => Object.fromEntries(
        Object.entries(map).map(([nodeId, ids]) => [nodeId, ids.filter(id => id !== assetId)])
      ))
    }
  }

  const toggleNodeAsset = (nodeId, assetId) => {
    setNodeAssetsMap(current => {
      const ids = current[nodeId] || []
      return {
        ...current,
        [nodeId]: ids.includes(assetId) ? ids.filter(id => id !== assetId) : [...ids, assetId]
      }
    })
  }

  const createQuickAsset = async (event) => {
    event.preventDefault()
    const ok = await runStep(async () => {
      const response = await axios.post('/api/asset', quickAsset, { headers: authHeaders() })
      await loadAssets()
      setPoolIds(current => [...current, response.data._id])
    })
    if (ok) setQuickAsset(null)
  }

  const poolAssets = assets.filter(asset => poolIds.includes(asset._id))
  // 资产库搜索：按名称 / 说明 / 类型 / 标签过滤
  const filteredAssets = (() => {
    const query = poolSearch.trim().toLowerCase()
    if (!query) return assets
    return assets.filter(asset =>
      [asset.name, asset.description, asset.assetType, ...(asset.tags || [])]
        .filter(Boolean)
        .some(text => String(text).toLowerCase().includes(query))
    )
  })()
  const orderedStages = [...(wf?.stages || [])].sort((a, b) => a.order - b.order)
  const totalNodes = orderedStages.reduce((sum, stage) => sum + (stage.steps?.length || 0), 0)
  const unboundNodes = findUnboundNodes(wf)
  const unboundSummary = unboundNodes.length <= 3
    ? unboundNodes.map(gap => gap.label).join('、')
    : `${unboundNodes.slice(0, 3).map(gap => gap.label).join('、')} 等 ${unboundNodes.length} 个`

  // Command 草稿的实时预览：参数 JSON 解析失败时退化为空参数，保证输入过程中不中断
  const draftCommandPreview = (() => {
    if (!commandDraft) return null
    let parameters = {}
    try {
      parameters = parseCommandParameters(commandDraft.parameters)
    } catch {
      parameters = {}
    }
    const draft = {
      name: normalizeCommandName(commandDraft.name || 'command'),
      description: commandDraft.description,
      parameters,
      bodyOverride: commandDraft.customizeBody ? commandDraft.bodyOverride : ''
    }
    return {
      invocation: cliInvocation(draft),
      body: compileCommandBody(wf, draft)
    }
  })()

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content wizard-content" onClick={event => event.stopPropagation()}>
        <header className="wizard-header">
          <div>
            <p className="page-eyebrow">{scenario?.name} · 场景设计</p>
            <h2>{workflow ? `继续设计：${wf?.name || workflow.name}` : '新建 Harness Workflow'}</h2>
          </div>
          <button className="wizard-close" type="button" onClick={onClose}>×</button>
        </header>

        <nav className="wizard-stepper">
          {WIZARD_STEPS.map((item, index) => (
            <div className="wizard-step-item" key={item.key}>
              {index > 0 && <div className={`wizard-step-line ${index <= maxReached ? 'reached' : ''}`} />}
              <button
                type="button"
                className={`wizard-step ${index === step ? 'current' : ''} ${index < step ? 'done' : ''}`}
                onClick={() => goToStep(index)}
                disabled={(index >= 2 && !workflowId) || index > maxReached}
              >
                <strong>{index + 1}</strong>
                <span>{item.label}</span>
              </button>
            </div>
          ))}
        </nav>

        <section className="wizard-body">
          {step === 0 && (
            <div className="wizard-step-panel">
              <p className="wizard-step-hint">
                先对齐业务场景：明确场景目标、输入输出与业务边界，后续 Workflow 与资产都围绕它展开。带 * 为必填项。
              </p>
              <div className="form-group">
                <label className="form-label">场景名称</label>
                <input
                  className="form-input"
                  value={scenarioForm.name}
                  onChange={event => setScenarioForm({ ...scenarioForm, name: event.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">场景编码</label>
                <input
                  className="form-input"
                  value={scenarioForm.code}
                  onChange={event => setScenarioForm({ ...scenarioForm, code: event.target.value })}
                  placeholder="例如：REQ-DEV"
                />
              </div>
              <div className="form-group">
                <label className="form-label">场景说明与目标 *</label>
                <textarea
                  className="form-input"
                  rows="5"
                  value={scenarioForm.description}
                  onChange={event => setScenarioForm({ ...scenarioForm, description: event.target.value })}
                  placeholder="描述场景目标、输入输出和业务边界"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="wizard-step-panel">
              <p className="wizard-step-hint">
                规划 Workflow 基本信息，并编排「环节 → 节点」：环节是逻辑分组（方便理解），节点是绑定 Agent / Skill 的原子执行单元。
              </p>
              <div className="wizard-form-grid">
                <div className="form-group">
                  <label className="form-label">流程名称</label>
                  <input
                    className="form-input"
                    value={workflowForm.name}
                    onChange={event => setWorkflowForm({ ...workflowForm, name: event.target.value })}
                    placeholder="例如：编解码开发作业流程"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">流程说明</label>
                  <input
                    className="form-input"
                    value={workflowForm.description}
                    onChange={event => setWorkflowForm({ ...workflowForm, description: event.target.value })}
                  />
                </div>
              </div>

              <div className="wizard-block-title">
                <span>环节与节点</span>
                <small>{orderedStages.length} 个环节 · {totalNodes} 个节点，按顺序执行</small>
              </div>
              <div className="wizard-type-palette">
                {stageTypes.map(type => (
                  <span className="wizard-type-chip" key={type}>
                    {type}
                    <button
                      type="button"
                      title="从调色板删除该类型"
                      onClick={() => removeStageType(type)}
                      disabled={saving}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <span className="wizard-type-add">
                  <input
                    className="form-input"
                    value={newStageType}
                    onChange={event => setNewStageType(event.target.value)}
                    placeholder="自定义类型，如：代码评审"
                  />
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={addStageType}
                    disabled={saving || !newStageType.trim()}
                  >
                    + 新建类型
                  </button>
                </span>
              </div>

              {!workflowId ? (
                <div className="wizard-empty-hint">填写流程名称后点击“下一步”，即可编排环节与节点。</div>
              ) : (
                <>
                  {orderedStages.length === 0 && !stageDraft && (
                    <div className="wizard-empty-hint">尚未定义环节，点击下方“添加环节”开始编排。</div>
                  )}
                  {orderedStages.map((stage, stageIndex) => {
                    const orderedNodes = [...(stage.steps || [])].sort((a, b) => a.order - b.order)
                    return (
                      <div className="wizard-stage-block" key={stage.id}>
                        <div className="wizard-stage-row">
                          <span className="wizard-stage-order">{stageIndex + 1}</span>
                          <div className="wizard-stage-info">
                            <b>{stage.name}</b>
                            <small>{stageTypeLabel(stage.type)}</small>
                          </div>
                          <div className="wizard-row-actions">
                            <button type="button" onClick={() => moveStage(stage.id, -1)} disabled={stageIndex === 0 || saving}>↑</button>
                            <button type="button" onClick={() => moveStage(stage.id, 1)} disabled={stageIndex === orderedStages.length - 1 || saving}>↓</button>
                            <button type="button" onClick={() => {
                              setStepDraft(null)
                              setStageDraft({ id: stage.id, name: stage.name, type: stage.type, description: stage.description || '' })
                            }}>编辑</button>
                            <button type="button" onClick={() => deleteStage(stage)} disabled={saving}>删除</button>
                          </div>
                        </div>

                        <div className="wizard-node-list">
                          {orderedNodes.map((node, nodeIndex) => (
                            <div className="wizard-node-row" key={node.id}>
                              <span className="wizard-node-index">{stageIndex + 1}.{nodeIndex + 1}</span>
                              <div className="wizard-stage-info">
                                <b>{node.name}</b>
                                {node.description && <small>{node.description}</small>}
                              </div>
                              <div className="wizard-row-actions">
                                <button type="button" onClick={() => moveNode(stage, node.id, -1)} disabled={nodeIndex === 0 || saving}>↑</button>
                                <button type="button" onClick={() => moveNode(stage, node.id, 1)} disabled={nodeIndex === orderedNodes.length - 1 || saving}>↓</button>
                                <button type="button" onClick={() => {
                                  setStageDraft(null)
                                  setStepDraft({ stageId: stage.id, id: node.id, name: node.name, description: node.description || '' })
                                }}>编辑</button>
                                <button type="button" onClick={() => deleteNode(stage.id, node.id)} disabled={saving}>删除</button>
                              </div>
                            </div>
                          ))}

                          {stepDraft?.stageId === stage.id ? (
                            <form className="wizard-inline-form" onSubmit={saveNode}>
                              <input
                                className="form-input"
                                value={stepDraft.name}
                                onChange={event => setStepDraft({ ...stepDraft, name: event.target.value })}
                                placeholder="节点名称，例如：解析协议字段"
                                required
                              />
                              <input
                                className="form-input"
                                value={stepDraft.description}
                                onChange={event => setStepDraft({ ...stepDraft, description: event.target.value })}
                                placeholder="节点说明（可选）"
                              />
                              <div className="wizard-inline-actions">
                                <button className="btn btn-primary" type="submit" disabled={saving}>
                                  {stepDraft.id ? '保存节点' : '添加节点'}
                                </button>
                                <button className="btn btn-secondary" type="button" onClick={() => setStepDraft(null)}>取消</button>
                              </div>
                            </form>
                          ) : (
                            <button
                              className="wizard-add-button compact"
                              type="button"
                              onClick={() => {
                                setStageDraft(null)
                                setStepDraft({ ...emptyStepDraft, stageId: stage.id })
                              }}
                            >
                              + 添加节点
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {stageDraft ? (
                    <form className="wizard-inline-form" onSubmit={saveStage}>
                      <div className="wizard-form-grid">
                        <input
                          className="form-input"
                          value={stageDraft.name}
                          onChange={event => setStageDraft({ ...stageDraft, name: event.target.value })}
                          placeholder="环节名称，例如：方案设计"
                          required
                        />
                        <select
                          className="form-input"
                          value={stageDraft.type}
                          onChange={event => setStageDraft({ ...stageDraft, type: event.target.value })}
                        >
                          {stageTypes.map(type => (
                            <option value={type} key={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <input
                        className="form-input"
                        value={stageDraft.description}
                        onChange={event => setStageDraft({ ...stageDraft, description: event.target.value })}
                        placeholder="环节说明（可选）"
                      />
                      <div className="wizard-inline-actions">
                        <button className="btn btn-primary" type="submit" disabled={saving}>
                          {stageDraft.id ? '保存环节' : '添加环节'}
                        </button>
                        <button className="btn btn-secondary" type="button" onClick={() => setStageDraft(null)}>取消</button>
                      </div>
                    </form>
                  ) : (
                    <button className="wizard-add-button" type="button" onClick={() => {
                      setStepDraft(null)
                      setStageDraft({ ...emptyStageDraft })
                    }}>
                      + 添加环节
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="wizard-step-panel">
              <p className="wizard-step-hint">
                定义发布后在 Claude Code TUI 中通过 /xxx 触发的命令：命令名、位置参数契约与指令正文。
              </p>
              {unboundNodes.length > 0 && (
                <div className="wizard-gap-warning">
                  ⚠️ {unboundNodes.length} 个节点尚未绑定 Agent / Skill（{unboundSummary}）。
                  未绑定的节点不会带资产信息进入 Command 正文，可在第 4 步完成绑定。
                </div>
              )}
              {(wf?.commands || []).length === 0 && !commandDraft && (
                <div className="wizard-empty-hint">尚未定义 Command 入口。</div>
              )}
              {(wf?.commands || []).map(command => (
                <div className="wizard-command-row" key={command.id}>
                  <code>{cliInvocation(command)}</code>
                  {command.bodyOverride
                    ? <span className="badge badge-warning">已自定义正文</span>
                    : <span>正文由环节编排自动生成</span>}
                  <div className="wizard-row-actions">
                    <button type="button" onClick={() => setCommandDraft({
                      id: command.id,
                      name: command.name,
                      description: command.description || '',
                      parameters: JSON.stringify(command.parameters || {}, null, 2),
                      bodyOverride: command.bodyOverride || '',
                      customizeBody: Boolean(command.bodyOverride)
                    })}>编辑</button>
                    <button type="button" onClick={() => deleteCommand(command.id)} disabled={saving}>删除</button>
                  </div>
                </div>
              ))}
              {commandDraft ? (
                <form className="wizard-inline-form" onSubmit={saveCommand}>
                  <div className="wizard-form-grid">
                    <input
                      className="form-input"
                      value={commandDraft.name}
                      onChange={event => setCommandDraft({ ...commandDraft, name: event.target.value })}
                      placeholder="/codec-generate（小写字母、数字、连字符）"
                      required
                    />
                    <input
                      className="form-input"
                      value={commandDraft.description}
                      onChange={event => setCommandDraft({ ...commandDraft, description: event.target.value })}
                      placeholder="命令说明：触发时机和预期结果（可选）"
                    />
                  </div>
                  <textarea
                    className="form-input wizard-json-input"
                    rows="4"
                    value={commandDraft.parameters}
                    onChange={event => setCommandDraft({ ...commandDraft, parameters: event.target.value })}
                    spellCheck="false"
                    placeholder='位置参数契约，如 { "input": "string", "lang": "string" }'
                  />
                  {draftCommandPreview && (
                    <div className="wizard-preview">
                      <div className="wizard-preview-title">TUI 调用预览</div>
                      <code className="wizard-preview-cli">{draftCommandPreview.invocation}</code>
                      <div className="wizard-preview-title">
                        <span>
                          Command 正文
                          {commandDraft.customizeBody && <span className="badge badge-warning">已自定义</span>}
                        </span>
                        {commandDraft.customizeBody ? (
                          <button
                            type="button"
                            onClick={() => setCommandDraft({ ...commandDraft, customizeBody: false, bodyOverride: '' })}
                          >
                            恢复自动生成
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCommandDraft({ ...commandDraft, customizeBody: true, bodyOverride: draftCommandPreview.body })}
                          >
                            自定义正文
                          </button>
                        )}
                      </div>
                      {commandDraft.customizeBody ? (
                        <textarea
                          className="form-input wizard-json-input"
                          rows="10"
                          value={commandDraft.bodyOverride}
                          onChange={event => setCommandDraft({ ...commandDraft, bodyOverride: event.target.value })}
                          spellCheck="false"
                        />
                      ) : (
                        <pre className="wizard-preview-body">{draftCommandPreview.body}</pre>
                      )}
                    </div>
                  )}
                  <div className="wizard-inline-actions">
                    <button className="btn btn-primary" type="submit" disabled={saving}>
                      {commandDraft.id ? '保存 Command' : '添加 Command'}
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={() => setCommandDraft(null)}>取消</button>
                  </div>
                </form>
              ) : (
                <button className="wizard-add-button" type="button" onClick={() => setCommandDraft({ ...emptyCommandDraft })}>
                  + 设计 Command
                </button>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="wizard-step-panel">
              <p className="wizard-step-hint">
                先圈定该 Workflow 可用的 Agent / Skill 资产池，再逐节点从池中分配执行资产（环节视图由节点自动汇总）。
              </p>

              <div className="wizard-block-title">
                <span>Workflow 资产池</span>
                <small>{poolIds.length} 个已选 · 移出资产池会同时解除相关节点的绑定</small>
              </div>
              {poolAssets.length > 0 && (
                <div className="wizard-pool-chips">
                  {poolAssets.map(asset => (
                    <span className="wizard-pool-chip" key={asset._id}>
                      <b>{asset.assetType}</b> {asset.name}
                      <button
                        type="button"
                        title="移出资产池"
                        onClick={() => togglePoolAsset(asset._id)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                className="form-input wizard-pool-search"
                value={poolSearch}
                onChange={event => setPoolSearch(event.target.value)}
                placeholder="搜索资产库：名称 / 说明 / 类型 / 标签"
              />
              <div className="wizard-asset-results">
                {filteredAssets.length === 0 ? (
                  <div className="wizard-empty-hint">
                    {assets.length === 0 ? '资产库为空，可点击下方快速创建。' : '没有匹配的资产，换个关键词试试。'}
                  </div>
                ) : (
                  filteredAssets.map(asset => (
                    <div className="wizard-asset-result" key={asset._id}>
                      <div className="wizard-stage-info">
                        <b>{asset.name}</b>
                        <small>
                          {asset.assetType} · v{asset.version} · {asset.status}
                          {asset.description ? ` · ${asset.description}` : ''}
                        </small>
                      </div>
                      {poolIds.includes(asset._id) ? (
                        <span className="badge badge-success">已在池中</span>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => togglePoolAsset(asset._id)}
                        >
                          + 添加
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
              {quickAsset ? (
                <form className="wizard-inline-form" onSubmit={createQuickAsset}>
                  <div className="wizard-form-grid">
                    <input
                      className="form-input"
                      value={quickAsset.name}
                      onChange={event => setQuickAsset({ ...quickAsset, name: event.target.value })}
                      placeholder="资产名称，例如：Codec Generator"
                      required
                    />
                    <select
                      className="form-input"
                      value={quickAsset.assetType}
                      onChange={event => setQuickAsset({ ...quickAsset, assetType: event.target.value })}
                    >
                      <option value="Agent">Agent</option>
                      <option value="Skill">Skill</option>
                    </select>
                  </div>
                  <input
                    className="form-input"
                    value={quickAsset.description}
                    onChange={event => setQuickAsset({ ...quickAsset, description: event.target.value })}
                    placeholder="资产能力说明（可选）"
                  />
                  <div className="wizard-inline-actions">
                    <button className="btn btn-primary" type="submit" disabled={saving}>创建并加入资产池</button>
                    <button className="btn btn-secondary" type="button" onClick={() => setQuickAsset(null)}>取消</button>
                  </div>
                </form>
              ) : (
                <button className="wizard-add-button" type="button" onClick={() => setQuickAsset({ ...emptyQuickAsset })}>
                  + 快速创建 Agent / Skill
                </button>
              )}

              <div className="wizard-block-title">
                <span>节点资产分配</span>
                <small>候选来自上方资产池的勾选结果</small>
              </div>
              {orderedStages.length === 0 || totalNodes === 0 ? (
                <div className="wizard-empty-hint">该 Workflow 尚未定义节点，可返回第 2 步在环节内添加。</div>
              ) : (
                <>
                  {poolAssets.length === 0 && (
                    <div className="wizard-empty-hint">
                      请先在资产池中勾选至少一个 Agent / Skill，然后回到这里逐节点分配。
                    </div>
                  )}
                  {orderedStages.map((stage, stageIndex) => (
                    <div className="wizard-stage-assign" key={stage.id}>
                      <div className="wizard-stage-info">
                        <b>环节 {stageIndex + 1}：{stage.name}</b>
                        <small>{stageTypeLabel(stage.type)}</small>
                      </div>
                      {[...(stage.steps || [])].sort((a, b) => a.order - b.order).map((node, nodeIndex) => {
                        const assignedIds = nodeAssetsMap[node.id] || []
                        const assignedAssets = poolAssets.filter(asset => assignedIds.includes(asset._id))
                        const addableAssets = poolAssets.filter(asset => !assignedIds.includes(asset._id))
                        return (
                          <div className="wizard-node-assign" key={node.id}>
                            <div className="wizard-node-assign-title">
                              {stageIndex + 1}.{nodeIndex + 1} {node.name}
                              {node.description && <small className="wizard-node-assign-desc">{node.description}</small>}
                            </div>
                            <div className="wizard-node-assets">
                              {assignedAssets.map(asset => (
                                <span className="wizard-pool-chip" key={asset._id}>
                                  <b>{asset.assetType}</b> {asset.name}
                                  <button
                                    type="button"
                                    title="从该节点移除"
                                    onClick={() => toggleNodeAsset(node.id, asset._id)}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              {poolAssets.length > 0 && addableAssets.length > 0 && (
                                <select
                                  className="form-input wizard-node-select"
                                  value=""
                                  onChange={event => {
                                    if (event.target.value) toggleNodeAsset(node.id, event.target.value)
                                  }}
                                >
                                  <option value="">+ 从资产池添加…</option>
                                  {addableAssets.map(asset => (
                                    <option value={asset._id} key={asset._id}>
                                      {asset.name}（{asset.assetType}）
                                    </option>
                                  ))}
                                </select>
                              )}
                              {assignedAssets.length === 0 && addableAssets.length === 0 && (
                                <span className="wizard-node-empty">未分配资产</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </section>

        <footer className="wizard-footer">
          <div className="wizard-error">{error}</div>
          <div className="wizard-footer-actions">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => goToStep(step - 1)}
              disabled={step === 0 || saving}
            >
              上一步
            </button>
            <button className="btn btn-primary" type="button" onClick={handleNext} disabled={saving}>
              {saving ? '保存中...' : step === WIZARD_STEPS.length - 1 ? '完成设计' : '下一步'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default WorkflowWizard

import express from 'express';
import Asset from '../models/Asset.js';

const router = express.Router();

// Get all assets
router.get('/', async (req, res) => {
  try {
    const { assetType, status, tag } = req.query;
    const query = {};
    if (assetType) query.assetType = assetType;
    if (status) query.status = status;
    if (tag) query.tags = tag;

    const assets = await Asset.find(query).sort({ createdAt: -1 });
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get asset by ID
router.get('/:id', async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new asset
router.post('/', async (req, res) => {
  try {
    const asset = new Asset(req.body);
    await asset.save();
    res.status(201).json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update asset
router.put('/:id', async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Publish asset
router.post('/:id/publish', async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    asset.status = 'published';
    asset.updatedAt = new Date();
    await asset.save();

    res.json({ message: 'Asset published', asset });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Search assets
router.get('/search/query', async (req, res) => {
  try {
    const { q, type } = req.query;
    const query = {
      status: 'published',
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [q] } }
      ]
    };

    if (type) query.assetType = type;

    const assets = await Asset.find(query).limit(20);
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rate asset
router.post('/:id/rate', async (req, res) => {
  try {
    const { rating } = req.body;
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Simple rating calculation
    const totalReviews = asset.marketplace.reviews || 0;
    const currentRating = asset.marketplace.rating || 0;
    asset.marketplace.rating = (currentRating * totalReviews + rating) / (totalReviews + 1);
    asset.marketplace.reviews = totalReviews + 1;

    await asset.save();
    res.json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

const router = require('express').Router();
const Contact = require('../models/Contact');
const { verifyToken, requireStaffOrAdmin } = require('../middleware/authMiddleware');

// Public — visitors submit the contact form
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    const contact = await Contact.create({ name, email, subject, message });
    req.app.get('io')?.emit('contact:new', contact);
    res.status(201).json({ success: true, message: 'Message sent — we\u2019ll get back to you.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

// Admin/staff — view & manage inbox
router.get('/', verifyToken, requireStaffOrAdmin, async (req, res) => {
  const contacts = await Contact.find().sort({ createdAt: -1 });
  res.json(contacts);
});

router.patch('/:id', verifyToken, requireStaffOrAdmin, async (req, res) => {
  const contact = await Contact.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  res.json(contact);
});

router.delete('/:id', verifyToken, requireStaffOrAdmin, async (req, res) => {
  await Contact.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;

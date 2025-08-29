const express = require('express');
const User = require('../models/User');
const router = express.Router();

// Create user (signup)
router.post('/', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ 
        error: 'Name and email are required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(200).json({ 
        message: 'User logged in successfully',
        user: existingUser 
      });
    }

    // Create new user
    const user = new User({ name, email });
    await user.save();

    res.status(201).json({ 
      message: 'User created successfully',
      user 
    });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: 'Email already exists' 
      });
    }
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Get user by email (for login)
router.get('/', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required' 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Get all users (for chat partner selection)
router.get('/all', async (req, res) => {
  try {
    const users = await User.find({}, 'name email');
    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

module.exports = router;

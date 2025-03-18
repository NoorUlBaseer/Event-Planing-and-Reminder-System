require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model('User', userSchema);

const eventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  description: String,
  date: { type: String, required: true },
  category: { type: String, enum: ['Meeting', 'Birthday', 'Appointment'], required: true },
  reminderMinutesBefore: Number,
  reminderSent: { type: Boolean, default: false },
});

const Event = mongoose.model('Event', eventSchema);

const auth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    req.user = await User.findById(decoded.id).select('-password');
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

const scheduleReminder = (event) => {
  const reminderTime = new Date(event.date) - event.reminderMinutesBefore * 60000;
  const delay = reminderTime - Date.now();

  if (delay > 0) {
    setTimeout(async () => {
      console.log(`🔔 Reminder: "${event.name}" is happening soon!`);
      event.reminderSent = true;
      await event.save();
    }, delay);
  }
};

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = new User({ username, password });
    await user.save();
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/events', auth, async (req, res) => {
  try {
    const { name, description, date, category, reminderMinutesBefore } = req.body;
    const event = new Event({
      user: req.user.id,
      name,
      description,
      date,
      category,
      reminderMinutesBefore,
    });
    await event.save();
    scheduleReminder(event);
    res.status(201).json({ message: 'Event created', event });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/events', auth, async (req, res) => {
  const { sortBy = 'date', filterCategory, reminderStatus } = req.query;
  let query = { user: req.user.id };
  if (filterCategory) query.category = filterCategory;
  if (reminderStatus !== undefined) query.reminderSent = reminderStatus === 'true';

  const events = await Event.find(query).sort(sortBy === 'date' ? { date: 1 } : { category: 1 });
  res.json(events);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;

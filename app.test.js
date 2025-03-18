const request = require('supertest');
const mongoose = require('mongoose');
const app = require('./app'); // Assuming app.js exports the app

beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/testDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Event Planner API', () => {
  it('should register a user', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({
        username: 'testuser',
        password: 'testpass',
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body.message).toBe('User registered');
  });
});

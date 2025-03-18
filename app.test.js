const request = require('supertest');
const mongoose = require('mongoose');
const app = require('./app'); // Assuming app.js exports the app

describe('Basic Test', () => {
    it('should print a console log message', () => {
      console.log('✅ Test is running successfully!');
    });
  });
  
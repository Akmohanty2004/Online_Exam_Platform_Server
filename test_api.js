const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

mongoose.connect('mongodb://127.0.0.1:27017/online_exam_platform').then(async () => {
  try {
    const student = await mongoose.connection.db.collection('users').findOne({ role: 'student' });
    const token = jwt.sign(
      { id: student._id, role: student.role },
      process.env.JWT_SECRET || 'secret123',
      { expiresIn: '1h' }
    );
    
    console.log(`Testing with student: ${student.email}`);
    
    const response = await fetch('http://localhost:5000/api/exams/6a440c32afe214e01b0f63e7/student', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Error');
    
    console.log("API Success!");
    console.log(`Questions returned: ${data.questions?.length}`);
    console.log(`Total questions: ${data.totalQuestions}`);
    
  } catch (error) {
    console.error("API Error:", error.message);
  } finally {
    process.exit(0);
  }
});

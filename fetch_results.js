const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'c:/Users/ashis/OneDrive/Desktop/project/online-exam-platform/server/.env' });

mongoose.connect('mongodb://127.0.0.1:27017/online_exam_platform').then(async () => {
  try {
    const exams = await mongoose.connection.db.collection('exams').find({ title: 'dgdfbg' }).toArray();
    if (exams.length > 0) {
      const examId = exams[0]._id;
      const teacherId = exams[0].createdBy;
      
      const token = jwt.sign({ userId: teacherId.toString(), role: 'teacher' }, process.env.JWT_SECRET || 'your-secret-key');
      
      const axios = require('axios');
      const res = await axios.get(`http://localhost:5000/api/results/exam/${examId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('API Response:', JSON.stringify(res.data, null, 2));
    }
  } catch(e) {
    if (e.response) {
       console.error('API Error Response:', JSON.stringify(e.response.data, null, 2));
    } else {
       console.error(e);
    }
  } finally {
    process.exit(0);
  }
});

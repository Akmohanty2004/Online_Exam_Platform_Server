const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const Result = require('../models/Result.model');
const Exam = require('../models/Exam.model');
const Question = require('../models/Question.model');
const User = require('../models/User.model');
const Notification = require('../models/Notification.model');

// Submit exam
router.post('/submit',
  authMiddleware,
  roleMiddleware('student'),
  validate([
    body('examId').isMongoId().withMessage('Invalid exam ID'),
    body('answers').isArray().withMessage('Answers must be an array'),
    body('timeTaken').isInt({ min: 0 }).withMessage('Invalid time taken'),
    body('tabSwitches').optional().isInt({ min: 0 })
  ]),
  async (req, res) => {
    try {
      const { examId, answers, timeTaken, tabSwitches = 0 } = req.body;

      // Check if exam exists and is available
      const exam = await Exam.findById(examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // Check if student has already submitted
      const existingResult = await Result.findOne({
        examId,
        studentId: req.userId
      });

      if (existingResult && existingResult.status === 'submitted') {
        return res.status(400).json({ message: 'You have already submitted this exam' });
      }

      // Get all questions for this exam
      const questions = await Question.find({ examId, isActive: true });

      // Calculate results
      let totalMarks = 0;
      let obtainedMarks = 0;
      let correctAnswers = 0;
      let wrongAnswers = 0;
      let unattempted = 0;

      const processedAnswers = questions.map(question => {
        const studentAnswer = answers.find(a => a.questionId === question._id.toString());
        const isCorrect = studentAnswer && studentAnswer.selectedAnswer === question.correctAnswer;
        
        let marksObtained = 0;
        if (studentAnswer) {
          if (isCorrect) {
            marksObtained = question.marks;
            correctAnswers++;
            obtainedMarks += question.marks;
          } else {
            if (exam.negativeMarking) {
              marksObtained = -(exam.negativeMarkValue || 0.25);
              obtainedMarks -= exam.negativeMarkValue || 0.25;
            }
            wrongAnswers++;
          }
        } else {
          unattempted++;
        }

        totalMarks += question.marks;

        return {
          questionId: question._id,
          selectedAnswer: studentAnswer ? studentAnswer.selectedAnswer : null,
          isCorrect,
          marksObtained
        };
      });

      // Calculate percentage and grade
      const percentage = (obtainedMarks / totalMarks) * 100;
      const isPassed = percentage >= exam.passingMarks;
      
      let grade = 'F';
      if (percentage >= 90) grade = 'A+';
      else if (percentage >= 80) grade = 'A';
      else if (percentage >= 70) grade = 'B+';
      else if (percentage >= 60) grade = 'B';
      else if (percentage >= 50) grade = 'C';
      else if (percentage >= 40) grade = 'D';

      // Create result
      const result = new Result({
        examId,
        studentId: req.userId,
        answers: processedAnswers,
        totalMarks,
        obtainedMarks,
        percentage,
        grade,
        isPassed,
        correctAnswers,
        wrongAnswers,
        unattempted,
        timeTaken,
        tabSwitches,
        status: 'submitted',
        submittedAt: new Date()
      });

      await result.save();

      // Update exam statistics
      exam.totalSubmitted += 1;
      if (isPassed) {
        exam.totalPassed += 1;
      } else {
        exam.totalFailed += 1;
      }
      exam.averageScore = (exam.averageScore * (exam.totalSubmitted - 1) + obtainedMarks) / exam.totalSubmitted;
      exam.highestScore = Math.max(exam.highestScore, obtainedMarks);
      exam.lowestScore = exam.lowestScore === 0 ? obtainedMarks : Math.min(exam.lowestScore, obtainedMarks);
      await exam.save();

      // Notify teacher
      const teacher = await User.findById(exam.createdBy);
      await Notification.create({
        userId: exam.createdBy,
        type: 'exam_submitted',
        title: 'Exam Submitted',
        message: `Student ${req.user.name} has submitted the exam "${exam.title}"`,
        data: { examId: exam._id, studentId: req.userId }
      });

      res.json({
        message: 'Exam submitted successfully',
        result: {
          id: result._id,
          obtainedMarks,
          totalMarks,
          percentage,
          grade,
          isPassed,
          correctAnswers,
          wrongAnswers,
          unattempted
        }
      });
    } catch (error) {
      console.error('Submit exam error:', error);
      res.status(500).json({ message: 'Failed to submit exam' });
    }
  }
);

// Get student results
router.get('/my-results',
  authMiddleware,
  roleMiddleware('student'),
  async (req, res) => {
    try {
      const results = await Result.find({ 
        studentId: req.userId,
        status: 'submitted'
      })
      .populate('examId', 'title subject date startTime endTime')
      .sort({ submittedAt: -1 });

      // Check if results are published and calculate rank
      const resultsWithPublishStatus = await Promise.all(results.map(async (result) => {
        const exam = await Exam.findById(result.examId);
        let rank = null;
        
        if (exam.isResultPublished) {
          const allExamResults = await Result.find({ examId: result.examId, status: 'submitted' }).sort({ obtainedMarks: -1 });
          rank = allExamResults.findIndex(r => r.studentId.toString() === result.studentId.toString()) + 1;
        }
        
        return {
          ...result.toObject(),
          isPublished: exam.isResultPublished,
          rank: rank
        };
      }));

      res.json({ results: resultsWithPublishStatus });
    } catch (error) {
      console.error('Get student results error:', error);
      res.status(500).json({ message: 'Failed to get results' });
    }
  }
);

// Get exam results for teacher/admin
router.get('/exam/:examId',
  authMiddleware,
  roleMiddleware('teacher', 'admin'),
  validate([
    param('examId').isMongoId().withMessage('Invalid exam ID')
  ]),
  async (req, res) => {
    try {
      const exam = await Exam.findById(req.params.examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      if (exam.createdBy.toString() !== req.userId.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const results = await Result.find({ 
        examId: req.params.examId
      })
      .populate('studentId', 'name email profileImage department')
      .sort({ obtainedMarks: -1 });

      // Calculate statistics
      const stats = {
        totalStudents: results.length,
        passed: results.filter(r => r.isPassed).length,
        failed: results.filter(r => !r.isPassed).length,
        averageScore: results.reduce((sum, r) => sum + r.obtainedMarks, 0) / (results.length || 1),
        highestScore: results.length > 0 ? Math.max(...results.map(r => r.obtainedMarks)) : 0,
        lowestScore: results.length > 0 ? Math.min(...results.map(r => r.obtainedMarks)) : 0,
        gradeDistribution: {
          'A+': results.filter(r => r.grade === 'A+').length,
          'A': results.filter(r => r.grade === 'A').length,
          'B+': results.filter(r => r.grade === 'B+').length,
          'B': results.filter(r => r.grade === 'B').length,
          'C': results.filter(r => r.grade === 'C').length,
          'D': results.filter(r => r.grade === 'D').length,
          'F': results.filter(r => r.grade === 'F').length
        }
      };

      res.json({
        results,
        stats,
        isPublished: exam.isResultPublished
      });
    } catch (error) {
      console.error('Get exam results error:', error);
      res.status(500).json({ message: 'Failed to get results' });
    }
  }
);

// Publish results
router.put('/:examId/publish',
  authMiddleware,
  roleMiddleware('teacher'),
  validate([
    param('examId').isMongoId().withMessage('Invalid exam ID')
  ]),
  async (req, res) => {
    try {
      const exam = await Exam.findById(req.params.examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      if (exam.createdBy.toString() !== req.userId.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if exam end time has passed
      const now = new Date();
      const endDateTime = new Date(exam.date);
      const [endHours, endMinutes] = exam.endTime.split(':');
      endDateTime.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);
      
      if (now < endDateTime) {
        return res.status(400).json({ message: 'Cannot publish results before the exam has ended.' });
      }

      exam.isResultPublished = true;
      await exam.save();

      // Notify all students who took the exam
      const results = await Result.find({ 
        examId: exam._id
      });

      const notifications = results.map(result => ({
        userId: result.studentId,
        type: 'result_published',
        title: 'Results Published',
        message: `Results for "${exam.title}" have been published`,
        data: { examId: exam._id, resultId: result._id }
      }));

      await Notification.insertMany(notifications);

      res.json({
        message: 'Results published successfully',
        isPublished: true
      });
    } catch (error) {
      console.error('Publish results error:', error);
      res.status(500).json({ message: 'Failed to publish results' });
    }
  }
);

module.exports = router;
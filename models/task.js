// Load required packages
const mongoose = require('mongoose');

// Define our task schema
const TaskSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Task name is required"]
    },
    description: {
        type: String,
        default: "description required"
    },
    deadline: {
        type: Date,
        required: [true, "Deadline is required"]
    },
    completed: {
        type: Boolean,
        default: false
    },
    assignedUser: {
        type: String,
        default: ""
    },
    assignedUserName: {
        type: String,
        default: "unassigned"
    },
    dateCreated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Task', TaskSchema);
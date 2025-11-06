module.exports = function (router) {
    const Task = require('../models/task');
    const User = require('../models/user');
    const mongoose = require('mongoose');

    var tasksRoute = router.route('/tasks');
    var tasksIdRoute = router.route('/tasks/:id');

    //GET:/tasks
    tasksRoute.get(async function (req, res) {
        try {
            const {where, sort, select, skip, limit, count} = req.query;

            let query = Task.find()
            //Used for guidance: https://stackoverflow.com/questions/58189804/how-to-filter-json-parse-results
            try {
                if (where) {
                    const filter = JSON.parse(where);
                    query = query.where(filter);
                }
                if (sort) {
                    const sortObj = JSON.parse(sort);
                    query = query.sort(sortObj);
                }
                if (select) {
                    const selectObj = JSON.parse(select);
                    query = query.select(selectObj);
                }
                if (skip) {
                    query = query.skip(parseInt(skip, 10));
                }
                if (limit) {
                    query = query.limit(parseInt(limit, 10));
                } else {
                    query = query.limit(100);
                }
                
                if (count === "true") {
                    const total = await Task.countDocuments(query.getFilter());
                    return res.status(200).json({ 
                        message: "OK",
                        data: total 
                    });
                }
            } catch (err) {
                return res.status(400).json({ 
                    message: "invalid request parameter",
                    data: "",
                });
            }

            const results = await query.exec();

            res.status(200).json({
                message: "OK",
                data: results,
            });

        } catch (err) {
            res.status(500).json({ 
                message: "server error", 
                data: "" 
            });
        }
    });
    
    //POST /tasks
    tasksRoute.post(async function (req, res) {
        const newTask = new Task(req.body);
        const err = newTask.validateSync();

        if (err) {
            return res.status(400).json({
                message: "invalid new task",
                data: "",
            });
        }

        const session = await mongoose.startSession();

        try {
            let savedTask;
            
            //save task first to get its _id
            await session.withTransaction(async () => {
                savedTask = await newTask.save({ session });
            });

            //then update user with the task _id
            if (savedTask.assignedUser && savedTask.assignedUser !== "") {
                const user = await User.findByIdAndUpdate(
                    savedTask.assignedUser,
                    { $addToSet: { pendingTasks: savedTask._id.toString() } },
                    { new: true }
                );
                
                if (user) {
                    //update the assignedUserName if user exists
                    savedTask.assignedUserName = user.name;
                    await savedTask.save();
                }
            }

            res.status(201).json({
                message: "task created successfully",
                data: savedTask,
            });
        } catch (err) {
            res.status(500).json({
                message: "failed to create new task",
                data: "",
            });
        } finally {
            session.endSession();
        }
    });

    //GET /tasks/:id
    tasksIdRoute.get(async function (req, res) {
        try {
            const taskId = req.params.id;

            if (!mongoose.Types.ObjectId.isValid(taskId)) {
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }

            //build query with select parameter support
            let query = Task.findById(taskId);
            
            if (req.query.select) {
                try {
                    const selectObj = JSON.parse(req.query.select);
                    query = query.select(selectObj);
                } catch (err) {
                    return res.status(400).json({ 
                        message: "invalid select parameter",
                        data: "",
                    });
                }
            }

            const task = await query.exec();

            if (!task) {
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }

            res.status(200).json({
                message: "OK",
                data: task,
            });

        } catch (err) {
            res.status(500).json({
                message: "server error",
                data: "",
            });
        }
    });

    //PUT /tasks/:id
    tasksIdRoute.put(async function (req, res) {
        try {
            const taskId = req.params.id;

            if (!mongoose.Types.ObjectId.isValid(taskId)) {
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }

            const oldTask = await Task.findById(taskId);
            if (!oldTask) {
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }

            //validate new task data
            const newTaskData = req.body;
            const newTask = new Task(newTaskData);
            const err = newTask.validateSync();
            
            if (err) {
                return res.status(400).json({
                    message: "task validation failed",
                    data: "",
                });
            }

            const oldAssignedUser = oldTask.assignedUser || "";
            const newAssignedUser = newTaskData.assignedUser || "";

            //remove task from old user
            if (oldAssignedUser !== "" && oldAssignedUser !== newAssignedUser) {
                await User.findByIdAndUpdate(
                    oldAssignedUser,
                    { $pull: { pendingTasks: taskId } }
                );
            }

            //add task to new user
            if (newAssignedUser !== "" && oldAssignedUser !== newAssignedUser) {
                const user = await User.findByIdAndUpdate(
                    newAssignedUser,
                    { $addToSet: { pendingTasks: taskId } },
                    { new: true }
                );
                
                if (user) {
                    newTaskData.assignedUserName = user.name;
                }
            }

            //replace the task
            const replacedTask = await Task.findOneAndReplace(
                { _id: taskId },
                newTaskData,
                { new: true, runValidators: true }
            );

            if (!replacedTask) {
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }

            res.status(200).json({
                message: "task updated successfully",
                data: replacedTask,
            });
        } catch (err) {
            res.status(500).json({
                message: "failed to update task",
                data: "",
            });
        }
    });

    //DELETE /tasks/:id
    tasksIdRoute.delete(async function (req, res) {
        try {
            const taskId = req.params.id;

            if (!mongoose.Types.ObjectId.isValid(taskId)) {
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }

            const task = await Task.findById(taskId);

            if (!task) {
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }
            
            //remove task from user pendingTasks
            if (task.assignedUser && task.assignedUser !== "") {
                await User.findByIdAndUpdate(
                    task.assignedUser,
                    { $pull: { pendingTasks: taskId } }
                );
            }

            //delete the task
            await Task.deleteOne({ _id: taskId });

            res.status(200).json({
                message: "task deleted successfully",
                data: task,
            });
        } catch (err) {
            res.status(500).json({
                message: "server error",
                data: "",
            });
        }
    });

    return router;
}
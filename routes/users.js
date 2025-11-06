module.exports = function (router) {
    const Task = require('../models/task');
    const User = require('../models/user');
    const mongoose = require('mongoose');

    var tasksRoute = router.route('/tasks');
    var tasksIdRoute = router.route('/tasks/:id');

    //GET: /api/tasks
    //respond with a list of tasks
    //supports query parameters: where, sort, select, skip, limit, count
    //limit mentioned in project description: 100 tasks
    tasksRoute.get(async function (req, res) {
        try {
            const {where, sort, select, skip, limit, count} = req.query;

            //start building Mongoose query
            let query = Task.find();
            
            try {
                //where-filter results based on JSON query
                if (where) {
                    const filter = JSON.parse(where);
                    query = query.where(filter);
                }
                
                //sort-specify order
                if (sort) {
                    const sortObj = JSON.parse(sort);
                    query = query.sort(sortObj);
                }
                
                //select-specify fields to include/exclude
                if (select) {
                    const selectObj = JSON.parse(select);
                    query = query.select(selectObj);
                }
                
                //skip-number of results to skip
                if (skip) {
                    query = query.skip(parseInt(skip, 10));
                }
                
                //limit-number of results to return 
                //default 100 for tasks
                if (limit) {
                    query = query.limit(parseInt(limit, 10));
                } else {
                    query = query.limit(100);
                }
                
                // count-if true, return count
                if (count === "true") {
                    const total = await Task.countDocuments(query.getFilter());
                    //response format: message + data fields
                    return res.status(200).json({ 
                        message: "OK",
                        data: total 
                    });
                }
            } catch (err) {
                //status code 400-bad request for invalid parameters
                return res.status(400).json({ 
                    message: "invalid request parameter",
                    data: "",
                });
            }

            //execute query
            const results = await query.exec();

            //status code 200-success
            //response format: message + data fields
            res.status(200).json({
                message: "OK",
                data: results,
            });

        } catch (err) {
            //status code 500: server error
            res.status(500).json({ 
                message: "server error", 
                data: "" 
            });
        }
    });
    
    //POST:/api/tasks
    //create a new task, respond with details
    //tasks require name and deadline
    //add task to user's pendingTasks if assigned
    tasksRoute.post(async function (req, res) {
        //create new task instance with request body
        const newTask = new Task(req.body);
        
        const err = newTask.validateSync();

        if (err) {
            //status code 400: bad request for validation failure
            return res.status(400).json({
                message: "invalid new task",
                data: "",
            });
        }

        //use transaction for data consistency
        const session = await mongoose.startSession();

        try {
            let savedTask;
            
            //save task FIRST to generate _id
            await session.withTransaction(async () => {
                savedTask = await newTask.save({ session });
            });

            //add task to user's pendingTasks if assigned
            if (savedTask.assignedUser && savedTask.assignedUser !== "") {
                const user = await User.findByIdAndUpdate(
                    savedTask.assignedUser,
                    { $addToSet: { pendingTasks: savedTask._id.toString() } },
                    { new: true }
                );
                
                //update assignedUserName with actual user name
                if (user) {
                    savedTask.assignedUserName = user.name;
                    await savedTask.save();
                }
            }

            //status code 201: created successfully
            res.status(201).json({
                message: "task created successfully",
                data: savedTask,
            });
        } catch (err) {
            //status code 500: server error
            res.status(500).json({
                message: "failed to create new task",
                data: "",
            });
        } finally {
            //clean up session
            session.endSession();
        }
    });

    //GET:/api/tasks/:id
    //respond with details of specified task or 404 error
    //supports select parameter for field filtering
    tasksIdRoute.get(async function (req, res) {
        try {
            const taskId = req.params.id;

            //validate ObjectId format
            if (!mongoose.Types.ObjectId.isValid(taskId)) {
                //status code 404: not found for invalid ID
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }

            //build query with select parameter support
            let query = Task.findById(taskId);
            
            //select: specify fields to include/exclude
            if (req.query.select) {
                try {
                    const selectObj = JSON.parse(req.query.select);
                    query = query.select(selectObj);
                } catch (err) {
                    //status code 400: bad request for invalid select
                    return res.status(400).json({ 
                        message: "invalid select parameter",
                        data: "",
                    });
                }
            }

            //execute query
            const task = await query.exec();

            if (!task) {
                //status code 404: not found
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }

            //status code 200: success
            res.status(200).json({
                message: "OK",
                data: task,
            });

        } catch (err) {
            //status code 500: server error
            res.status(500).json({
                message: "server error",
                data: "",
            });
        }
    });

    //PUT:/api/tasks/:id
    //replace entire task with supplied task or 404 error
    //tasks require name and deadline
    //update user's pendingTasks when assignedUser changes
    tasksIdRoute.put(async function (req, res) {
        try {
            const taskId = req.params.id;

            //validate ObjectId format
            if (!mongoose.Types.ObjectId.isValid(taskId)) {
                //status code 404: not found for invalid ID
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }

            //get existing task
            const oldTask = await Task.findById(taskId);
            if (!oldTask) {
                //status code 404: not found
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }

            //validate new task data (name and deadline)
            const newTask = new Task(req.body);
            const err = newTask.validateSync();
            
            if (err) {
                //status code 400: bad request for validation failure
                return res.status(400).json({
                    message: "task validation failed",
                    data: "",
                });
            }

            //track changes in assignedUser
            const oldAssignedUser = oldTask.assignedUser || "";
            const newAssignedUser = newTask.assignedUser || "";

            //remove task from OLD user's pendingTasks
            if (oldAssignedUser !== "" && oldAssignedUser !== newAssignedUser) {
                await User.findByIdAndUpdate(
                    oldAssignedUser,
                    { $pull: { pendingTasks: taskId } }
                );
            }

            //add task to NEW user's pendingTasks
            if (newAssignedUser !== "" && oldAssignedUser !== newAssignedUser) {
                const user = await User.findByIdAndUpdate(
                    newAssignedUser,
                    { $addToSet: { pendingTasks: taskId } },
                    { new: true }
                );
                
                //update assignedUserName with actual user name
                if (user) {
                    newTask.assignedUserName = user.name;
                }
            }

            //replace the entire task document
            const replacedTask = await Task.findOneAndReplace(
                { _id: taskId },
                newTask.toObject(),
                { new: true, runValidators: true }
            );

            if (!replacedTask) {
                //status code 404: not found
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }

            //status code 200: success
            res.status(200).json({
                message: "task updated successfully",
                data: replacedTask,
            });
        } catch (err) {
            //status code 500: server error
            res.status(500).json({
                message: "failed to update task",
                data: "",
            });
        }
    });

    //DELETE:/api/tasks/:id
    //delete specified task or 404 error
    //remove task from user's pendingTasks
    tasksIdRoute.delete(async function (req, res) {
        try {
            const taskId = req.params.id;

            //validate ObjectId format
            if (!mongoose.Types.ObjectId.isValid(taskId)) {
                //status code 404: not found for invalid ID
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }

            //get task to access assignedUser
            const task = await Task.findById(taskId);

            if (!task) {
                //status code 404: not found
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }
            
            //remove task from user's pendingTasks
            if (task.assignedUser && task.assignedUser !== "") {
                await User.findByIdAndUpdate(
                    task.assignedUser,
                    { $pull: { pendingTasks: taskId } }
                );
            }

            //delete the task
            await Task.deleteOne({ _id: taskId });

            //status code 200: success
            res.status(200).json({
                message: "task deleted successfully",
                data: task,
            });
        } catch (err) {
            //status code 500: server error
            res.status(500).json({
                message: "server error",
                data: "",
            });
        }
    });

    return router;
}
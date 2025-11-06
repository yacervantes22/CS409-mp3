module.exports = function (router) {
    const User = require('../models/user');
    const mongoose = require('mongoose');

    var usersRoute = router.route('/users');
    var usersIdRoute = router.route('/users/:id');

    // GET: /api/users
    usersRoute.get(async function (req, res) {
        try {
            const { where, sort, select, skip, limit, count } = req.query;

            let query = User.find();

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
                    const total = await User.countDocuments(query.getFilter());
                    return res.status(200).json({ message: "OK", data: total });
                }
            } catch (err) {
                return res.status(400).json({ message: "invalid request parameter", data: "" });
            }

            const results = await query.exec();
            res.status(200).json({ message: "OK", data: results });

        } catch (err) {
            res.status(500).json({ message: "server error", data: "" });
        }
    });

    // POST: /api/users
    usersRoute.post(async function (req, res) {
        const newUser = new User(req.body);
        const err = newUser.validateSync();

        if (err) {
            return res.status(400).json({ message: "invalid new user", data: "" });
        }

        try {
            await newUser.save();
            res.status(201).json({ message: "user created successfully", data: newUser });
        } catch (err) {
            res.status(500).json({ message: "failed to create user", data: "" });
        }
    });

    // GET: /api/users/:id
    usersIdRoute.get(async function (req, res) {
        try {
            const userId = req.params.id;

            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(404).json({ message: "user not found", data: "" });
            }

            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ message: "user not found", data: "" });

            res.status(200).json({ message: "OK", data: user });
        } catch (err) {
            res.status(500).json({ message: "server error", data: "" });
        }
    });

    // PUT: /api/users/:id
    usersIdRoute.put(async function (req, res) {
        try {
            const userId = req.params.id;

            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(404).json({ message: "user not found", data: "" });
            }

            const updatedUser = await User.findByIdAndUpdate(userId, req.body, {
                new: true,
                runValidators: true
            });

            if (!updatedUser) return res.status(404).json({ message: "user not found", data: "" });

            res.status(200).json({ message: "user updated successfully", data: updatedUser });
        } catch (err) {
            res.status(500).json({ message: "failed to update user", data: "" });
        }
    });

    // DELETE: /api/users/:id
    usersIdRoute.delete(async function (req, res) {
        try {
            const userId = req.params.id;

            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(404).json({ message: "user not found", data: "" });
            }

            const deletedUser = await User.findByIdAndDelete(userId);
            if (!deletedUser) return res.status(404).json({ message: "user not found", data: "" });

            res.status(200).json({ message: "user deleted successfully", data: deletedUser });
        } catch (err) {
            res.status(500).json({ message: "server error", data: "" });
        }
    });

    return router;
};
const {
    User
} = require('../models');

exports.getUserById = async (id) => {
    return await User.findByPk(id);
};

exports.updateUserProfile = async (id, data) => {
    const {
        fullName,
        username,
        phone,
        email,
        address,
        newpassword
    } = data;

    const updateData = {
        fullName,
        username,
        phone,
        email,
        address
    };
    if (newpassword) {
        const bcrypt = require('bcryptjs');
        updateData.password = await bcrypt.hash(newpassword, 10);
    }

    return await User.update(updateData, {
        where: {
            id
        }
    });
};

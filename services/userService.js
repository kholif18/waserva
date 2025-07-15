const {
    User
} = require('../models');
const bcrypt = require('bcryptjs');
const {
    Op
} = require('sequelize');

exports.getUserById = async (id) => {
    return await User.findByPk(id);
};

exports.updateUserProfile = async (id, data) => {
    const {
        name,
        username,
        phone,
        email,
        address,
        newpassword
    } = data;

    const existing = await User.findOne({
        where: {
            [Op.or]: [{
                username
            }, {
                email
            }],
            id: {
                [Op.ne]: id
            } // bukan diri sendiri
        }
    });
    if (existing) throw new Error('Username atau email sudah digunakan.');
    
    const updateData = {
        name,
        username,
        phone,
        email,
        address
    };
    if (newpassword) {
        const bcrypt = require('bcryptjs');
        updateData.password = await bcrypt.hash(newpassword, 10);
    }

    const [updated] = await User.update(updateData, {
        where: {
            id
        }
    });
    if (!updated) throw new Error('Gagal update, user tidak ditemukan.');

    return true;
};

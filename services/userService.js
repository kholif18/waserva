const {
    User
} = require('../models');
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
        password,
        profile_image
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
        address,
        profile_image
    };
    if (password) {
        updateData.password = password;
    }

    console.log('DATA YANG AKAN DIUPDATE:', updateData);

    const [updated] = await User.update(updateData, {
        where: {
            id
        }
    });
    if (!updated) throw new Error('Gagal update, user tidak ditemukan.');

    return true;
};

exports.findUserByUsernameOrEmail = async (username, email, excludeId) => {
    return await User.findOne({
        where: {
            [Op.or]: [{
                username
            }, {
                email
            }],
            id: {
                [Op.ne]: excludeId
            }
        }
    });
};

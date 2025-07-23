const {
    AdminSetting
} = require('../models');

exports.getAdminSettingValue = async (key) => {
    const setting = await AdminSetting.findOne({
        where: {
            key
        }
    });
    return setting?.value || null;
};

exports.getMultipleSettings = async (keys) => {
    const settings = await AdminSetting.findAll({
        where: {
            key: keys
        }
    });

    const map = {};
    settings.forEach(s => {
        map[s.key] = s.value;
    });
    return map;
};

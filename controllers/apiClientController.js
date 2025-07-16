'use strict';
const {
    ApiClient,
    User
} = require('../models');
const crypto = require('crypto');

// Helper: convert app name to slug format
function slugify(str) {
    return str
        .trim()
        .replace(/\s+/g, '_') // replace spaces with underscores
        .replace(/[^\w\-]+/g, '') // remove special characters
        .replace(/\_+/g, '_'); // remove duplicate underscores
}

// Display list of API Clients
exports.index = async (req, res) => {
    try {
        const clients = await ApiClient.findAll({
            where: {
                userId: req.session.user.id
            }
        });

        // ⬇️ Ambil data user dari DB supaya lengkap
        const user = await User.findByPk(req.session.user.id);

        res.render('pages/api-clients', {
            title: 'API Clients',
            user,
            clients
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load API clients.');
        res.redirect('/');
    }
};

// Add new API Client
exports.add = async (req, res) => {
    try {
        const {
            app_name
        } = req.body;

        // Check for duplicate app name per user
        const existing = await ApiClient.findOne({
            where: {
                userId: req.session.user.id,
                appName: app_name
            }
        });

        if (existing) {
            req.flash('error', 'Application name is already used.');
            return res.redirect('/api-clients');
        }

        const token = crypto.randomBytes(32).toString('base64');

        const slugAppName = slugify(app_name);

        await ApiClient.create({
            userId: req.session.user.id,
            appName: slugAppName, // gunakan slug
            sessionName: slugAppName, // tetap slug
            apiToken: token,
            createdBy: req.session.user.id,
            isActive: true
        });

        req.flash('success', 'API Client added successfully.');
        res.redirect('/api-clients');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to add client.');
        res.redirect('/api-clients');
    }
};

// Toggle active/inactive status
exports.toggleActive = async (req, res) => {
    try {
        const client = await ApiClient.findOne({
            where: {
                id: req.params.id,
                userId: req.session.user.id
            }
        });

        if (!client) {
            req.flash('error', 'Client not found.');
            return res.redirect('/api-clients');
        }

        await client.update({
            isActive: !client.isActive
        });

        req.flash('success', 'Client status updated.');
        res.redirect('/api-clients');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to update status.');
        res.redirect('/api-clients');
    }
};

// Regenerate API token
exports.regenerate = async (req, res) => {
    try {
        const client = await ApiClient.findOne({
            where: {
                id: req.params.id,
                userId: req.session.user.id
            }
        });

        if (!client) {
            req.flash('error', 'Client not found.');
            return res.redirect('/api-clients');
        }

        const newToken = crypto.randomBytes(32).toString('base64');

        await client.update({
            apiToken: newToken
        });

        req.flash('success', 'Token regenerated successfully.');
        res.redirect('/api-clients');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to regenerate token.');
        res.redirect('/api-clients');
    }
};

// Delete API Client
exports.delete = async (req, res) => {
    try {
        await ApiClient.destroy({
            where: {
                id: req.params.id,
                userId: req.session.user.id
            }
        });

        req.flash('success', 'API Client deleted successfully.');
        res.redirect('/api-clients');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to delete client.');
        res.redirect('/api-clients');
    }
};

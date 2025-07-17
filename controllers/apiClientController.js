'use strict';
const {
    ApiClient,
    User
} = require('../models');
const logService = require('../services/logService');
const crypto = require('crypto');
const dayjs = require('dayjs');

// Helper: convert app name to slug format
function slugify(str) {
    return str
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^\w\-]+/g, '')
        .replace(/\_+/g, '_');
}

// Display list of API Clients
exports.index = async (req, res) => {
    try {
        const clients = await ApiClient.findAll({
            where: {
                userId: req.session.user.id
            }
        });

        const user = await User.findByPk(req.session.user.id);

        const formattedClients = clients.map(client => ({
            ...client.get({
                plain: true
            }),
            formattedCreatedAt: dayjs(client.createdAt).format('DD-MM-YYYY HH:mm'),
            formattedUpdatedAt: dayjs(client.updatedAt).format('DD-MM-YYYY HH:mm'),
        }));

        res.render('pages/api-clients', {
            title: 'API Clients',
            user,
            clients: formattedClients
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
            appName: slugAppName,
            sessionName: slugAppName,
            apiToken: token,
            createdBy: req.session.user.id,
            isActive: true
        });

        await logService.createLog({
            userId: req.session.user.id,
            level: 'INFO',
            message: `Created API Client: ${slugAppName}`
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

        await logService.createLog({
            userId: req.session.user.id,
            level: 'INFO',
            message: `Toggled API Client status: ${client.appName} → ${!client.isActive ? 'INACTIVE' : 'ACTIVE'}`
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

        await logService.createLog({
            userId: req.session.user.id,
            level: 'WARN',
            message: `Regenerated token for API Client: ${client.appName}`
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
        const deleted = await ApiClient.destroy({
            where: {
                id: req.params.id,
                userId: req.session.user.id
            }
        });

        if (deleted) {
            await logService.createLog({
                userId: req.session.user.id,
                level: 'ERROR',
                message: `Deleted API Client: ID ${req.params.id}`
            });
        }

        req.flash('success', 'API Client deleted successfully.');
        res.redirect('/api-clients');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to delete client.');
        res.redirect('/api-clients');
    }
};

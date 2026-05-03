<?php
// =====================================================================
// /api/notifications.php — list / mark-read user notifications
// Routing: ?action=list | mark_read | mark_all_read
// =====================================================================

declare(strict_types=1);
require_once __DIR__ . '/../config/helpers.php';

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'list':          list_notifications(); break;
        case 'mark_read':     mark_read();          break;
        case 'mark_all_read': mark_all_read();      break;
        default:              json_error('Unknown action', 404);
    }
} catch (Throwable $e) {
    json_error($e->getMessage(), 500);
}

function list_notifications(): void {
    $u = require_auth();
    $stmt = db()->prepare(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
    );
    $stmt->execute([$u['id']]);
    json_response(['notifications' => $stmt->fetchAll()]);
}

function mark_read(): void {
    $u = require_auth();
    $b = read_json_body();
    $id = (string)($b['id'] ?? '');
    if ($id === '') json_error('id required');
    db()->prepare('UPDATE notifications SET `read` = 1 WHERE id = ? AND user_id = ?')
        ->execute([$id, $u['id']]);
    json_response(['success' => true]);
}

function mark_all_read(): void {
    $u = require_auth();
    db()->prepare('UPDATE notifications SET `read` = 1 WHERE user_id = ?')->execute([$u['id']]);
    json_response(['success' => true]);
}

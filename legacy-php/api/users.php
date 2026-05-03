<?php
// =====================================================================
// /api/users.php — Master-admin user management
// Routing:
//   ?action=list            list all users + role
//   ?action=set_role        change a user's role
//   ?action=delete          delete a user (cascades app data)
// =====================================================================

declare(strict_types=1);
require_once __DIR__ . '/../config/helpers.php';

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'list':     list_users();    break;
        case 'set_role': set_role();      break;
        case 'delete':   delete_user();   break;
        default:         json_error('Unknown action', 404);
    }
} catch (Throwable $e) {
    json_error($e->getMessage(), 500);
}

function list_users(): void {
    require_role('master_admin');
    $rows = db()->query(
        "SELECT p.id, p.full_name, p.email, p.student_id, p.course, p.batch,
                COALESCE(
                  (SELECT role FROM user_roles
                   WHERE user_id = p.id
                   ORDER BY FIELD(role,'master_admin','dept_admin','student')
                   LIMIT 1),
                  'student'
                ) AS role,
                (SELECT department_id FROM user_roles
                 WHERE user_id = p.id
                 ORDER BY FIELD(role,'master_admin','dept_admin','student')
                 LIMIT 1) AS department_id
         FROM profiles p
         ORDER BY p.created_at DESC"
    )->fetchAll();
    json_response(['users' => $rows]);
}

function set_role(): void {
    $me = require_role('master_admin');
    $b  = read_json_body();
    $userId = (string)($b['user_id'] ?? '');
    $role   = (string)($b['role']    ?? '');
    $deptId = $b['department_id'] ?? null;

    if (!in_array($role, ['student','dept_admin','master_admin'], true)) json_error('Invalid role');
    if ($userId === '') json_error('user_id required');
    if ($userId === $me['id']) json_error("You can't change your own role", 400);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM user_roles WHERE user_id = ?')->execute([$userId]);
        $pdo->prepare('INSERT INTO user_roles (id, user_id, role, department_id) VALUES (?, ?, ?, ?)')
            ->execute([uuid_v4(), $userId, $role, $role === 'dept_admin' ? $deptId : null]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    audit($me['id'], null, null, 'role_changed', "user=$userId role=$role");
    json_response(['success' => true]);
}

function delete_user(): void {
    $me = require_role('master_admin');
    $b  = read_json_body();
    $userId = (string)($b['user_id'] ?? '');
    if ($userId === '') json_error('user_id required');
    if ($userId === $me['id']) json_error("You can't delete your own account", 400);

    // FK cascades on users handle the rest of the cleanup.
    $stmt = db()->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$userId]);

    audit($me['id'], null, null, 'user_deleted', "user=$userId");
    json_response(['success' => true]);
}

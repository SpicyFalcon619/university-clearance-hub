<?php
// =====================================================================
// /api/applications.php — Student application CRUD + status
// Routing: ?action=create | list | detail | mine
// =====================================================================

declare(strict_types=1);
require_once __DIR__ . '/../config/helpers.php';

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'create': create_application(); break;
        case 'mine':   list_mine();          break;
        case 'list':   list_all();           break;
        case 'detail': get_detail();         break;
        default:       json_error('Unknown action', 404);
    }
} catch (Throwable $e) {
    json_error($e->getMessage(), 500);
}

function create_application(): void {
    $u = require_role('student');
    $b = read_json_body();

    $course = trim((string)($b['course'] ?? ''));
    $batch  = trim((string)($b['batch']  ?? ''));
    $reason = trim((string)($b['reason'] ?? ''));
    $isEmer = !empty($b['is_emergency']) ? 1 : 0;
    $emerJ  = trim((string)($b['emergency_justification'] ?? ''));

    if ($course === '' || $batch === '') json_error('Course and batch required');

    $appId = uuid_v4();
    db()->prepare(
        'INSERT INTO applications
            (id, student_id, course, batch, reason, is_emergency, emergency_justification)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    )->execute([$appId, $u['id'], $course, $batch, $reason ?: null, $isEmer, $emerJ ?: null]);

    audit($u['id'], $appId, null, 'application_created');
    json_response(['success' => true, 'id' => $appId]);
}

function list_mine(): void {
    $u = require_role('student');
    $stmt = db()->prepare(
        'SELECT * FROM applications WHERE student_id = ? ORDER BY created_at DESC'
    );
    $stmt->execute([$u['id']]);
    json_response(['applications' => $stmt->fetchAll()]);
}

function list_all(): void {
    require_role('master_admin', 'dept_admin');
    $rows = db()->query(
        'SELECT a.*, p.full_name, p.email, p.student_id AS sid
         FROM applications a
         LEFT JOIN profiles p ON p.id = a.student_id
         ORDER BY a.created_at DESC'
    )->fetchAll();
    json_response(['applications' => $rows]);
}

function get_detail(): void {
    $u   = require_auth();
    $id  = (string)($_GET['id'] ?? '');
    if ($id === '') json_error('id required');

    $a = db()->prepare('SELECT * FROM applications WHERE id = ?');
    $a->execute([$id]);
    $app = $a->fetch();
    if (!$app) json_error('Not found', 404);

    if ($u['role'] === 'student' && $app['student_id'] !== $u['id']) {
        json_error('Forbidden', 403);
    }

    $ds = db()->prepare(
        'SELECT ds.*, d.name AS department_name
         FROM department_status ds
         JOIN departments d ON d.id = ds.department_id
         WHERE ds.application_id = ?
         ORDER BY d.name'
    );
    $ds->execute([$id]);

    $audit = db()->prepare(
        'SELECT al.*, p.full_name AS actor_name
         FROM audit_log al
         LEFT JOIN profiles p ON p.id = al.actor_id
         WHERE al.application_id = ?
         ORDER BY al.created_at DESC'
    );
    $audit->execute([$id]);

    json_response([
        'application' => $app,
        'departments' => $ds->fetchAll(),
        'audit'       => $audit->fetchAll(),
    ]);
}

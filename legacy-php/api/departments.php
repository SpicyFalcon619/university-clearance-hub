<?php
// =====================================================================
// /api/departments.php — list/manage departments + dept-admin queue/review
// Routing:
//   ?action=list                 (any auth)
//   ?action=create               (master_admin)
//   ?action=update               (master_admin)
//   ?action=queue                (dept_admin) — pending items in my dept
//   ?action=review               (dept_admin) — approve/deny a row
// =====================================================================

declare(strict_types=1);
require_once __DIR__ . '/../config/helpers.php';

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'list':   list_departments(); break;
        case 'create': create_department(); break;
        case 'update': update_department(); break;
        case 'queue':  dept_queue();        break;
        case 'review': dept_review();       break;
        default:       json_error('Unknown action', 404);
    }
} catch (Throwable $e) {
    json_error($e->getMessage(), 500);
}

function list_departments(): void {
    require_auth();
    $rows = db()->query('SELECT * FROM departments ORDER BY name')->fetchAll();
    json_response(['departments' => $rows]);
}

function create_department(): void {
    require_role('master_admin');
    $b = read_json_body();
    $name = trim((string)($b['name'] ?? ''));
    if ($name === '') json_error('Name required');

    $id = uuid_v4();
    db()->prepare('INSERT INTO departments (id, name, description, active) VALUES (?, ?, ?, 1)')
        ->execute([$id, $name, trim((string)($b['description'] ?? '')) ?: null]);
    json_response(['success' => true, 'id' => $id]);
}

function update_department(): void {
    require_role('master_admin');
    $b = read_json_body();
    $id = (string)($b['id'] ?? '');
    if ($id === '') json_error('id required');
    db()->prepare('UPDATE departments SET name = ?, description = ?, active = ? WHERE id = ?')
        ->execute([
            trim((string)($b['name'] ?? '')),
            trim((string)($b['description'] ?? '')) ?: null,
            !empty($b['active']) ? 1 : 0,
            $id,
        ]);
    json_response(['success' => true]);
}

function dept_queue(): void {
    $u = require_role('dept_admin');
    if (!$u['department_id']) json_error('No department assigned', 400);

    $stmt = db()->prepare(
        'SELECT ds.*, a.course, a.batch, a.is_emergency,
                p.full_name, p.email, p.student_id AS sid
         FROM department_status ds
         JOIN applications a ON a.id = ds.application_id
         LEFT JOIN profiles p ON p.id = a.student_id
         WHERE ds.department_id = ? AND ds.status = ?
         ORDER BY a.is_emergency DESC, a.created_at ASC'
    );
    $stmt->execute([$u['department_id'], 'pending']);
    json_response(['queue' => $stmt->fetchAll()]);
}

function dept_review(): void {
    $u = require_role('dept_admin', 'master_admin');
    $b = read_json_body();
    $rowId    = (string)($b['id']       ?? '');
    $decision = (string)($b['decision'] ?? '');
    $comments = trim((string)($b['comments'] ?? ''));

    if (!in_array($decision, ['approved', 'denied'], true)) json_error('Invalid decision');
    if ($rowId === '') json_error('id required');

    $row = db()->prepare('SELECT * FROM department_status WHERE id = ?');
    $row->execute([$rowId]);
    $ds = $row->fetch();
    if (!$ds) json_error('Not found', 404);

    if ($u['role'] === 'dept_admin' && $ds['department_id'] !== $u['department_id']) {
        json_error('Forbidden', 403);
    }

    db()->prepare(
        'UPDATE department_status
            SET status = ?, comments = ?, reviewed_by = ?, reviewed_at = NOW(),
                undo_deadline = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
          WHERE id = ?'
    )->execute([$decision, $comments ?: null, $u['id'], $rowId]);

    audit($u['id'], $ds['application_id'], $ds['department_id'],
          $decision === 'approved' ? 'dept_approved' : 'dept_denied', $comments ?: null);

    // Notify the student
    $a = db()->prepare('SELECT student_id FROM applications WHERE id = ?');
    $a->execute([$ds['application_id']]);
    if ($app = $a->fetch()) {
        notify($app['student_id'], $ds['application_id'],
               'Department ' . $decision,
               'A department has ' . $decision . ' your clearance.');
    }

    json_response(['success' => true]);
}

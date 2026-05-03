<?php
// =====================================================================
// /api/documents.php — upload / list documents tied to an application
// Routing: ?action=upload | list | delete
// Files are stored under  legacy-php/uploads/<application_id>/<uuid>_<name>
// =====================================================================

declare(strict_types=1);
require_once __DIR__ . '/../config/helpers.php';

const UPLOAD_ROOT = __DIR__ . '/../uploads';

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'upload': upload_doc(); break;
        case 'list':   list_docs();  break;
        case 'delete': delete_doc(); break;
        default:       json_error('Unknown action', 404);
    }
} catch (Throwable $e) {
    json_error($e->getMessage(), 500);
}

function upload_doc(): void {
    $u = require_auth();
    $appId = (string)($_POST['application_id'] ?? '');
    $deptId = (string)($_POST['department_id'] ?? '') ?: null;
    if ($appId === '' || empty($_FILES['file'])) json_error('application_id and file required');

    $f = $_FILES['file'];
    if ($f['error'] !== UPLOAD_ERR_OK) json_error('Upload failed', 400);
    if ($f['size'] > 10 * 1024 * 1024) json_error('File too large (max 10MB)');

    $dir = UPLOAD_ROOT . '/' . $appId;
    if (!is_dir($dir) && !mkdir($dir, 0775, true)) json_error('Cannot create upload dir', 500);

    $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', $f['name']);
    $diskName = uuid_v4() . '_' . $safeName;
    $diskPath = $dir . '/' . $diskName;
    if (!move_uploaded_file($f['tmp_name'], $diskPath)) json_error('Cannot save file', 500);

    $rel = 'uploads/' . $appId . '/' . $diskName;
    $id  = uuid_v4();
    db()->prepare(
        'INSERT INTO documents
            (id, application_id, department_id, uploaded_by, file_name, file_path, mime_type, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([$id, $appId, $deptId, $u['id'], $f['name'], $rel,
                $f['type'] ?: null, (int)$f['size']]);

    audit($u['id'], $appId, $deptId, 'document_uploaded', $f['name']);
    json_response(['success' => true, 'id' => $id, 'path' => $rel]);
}

function list_docs(): void {
    require_auth();
    $appId = (string)($_GET['application_id'] ?? '');
    if ($appId === '') json_error('application_id required');
    $stmt = db()->prepare('SELECT * FROM documents WHERE application_id = ? ORDER BY created_at DESC');
    $stmt->execute([$appId]);
    json_response(['documents' => $stmt->fetchAll()]);
}

function delete_doc(): void {
    $u = require_auth();
    $b = read_json_body();
    $id = (string)($b['id'] ?? '');
    if ($id === '') json_error('id required');

    $stmt = db()->prepare('SELECT * FROM documents WHERE id = ?');
    $stmt->execute([$id]);
    $doc = $stmt->fetch();
    if (!$doc) json_error('Not found', 404);
    if ($doc['uploaded_by'] !== $u['id'] && $u['role'] !== 'master_admin') json_error('Forbidden', 403);

    @unlink(__DIR__ . '/../' . $doc['file_path']);
    db()->prepare('DELETE FROM documents WHERE id = ?')->execute([$id]);
    json_response(['success' => true]);
}

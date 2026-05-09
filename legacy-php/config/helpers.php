<?php
// =====================================================================
// Clearance — Shared helpers (sessions, JSON I/O, auth guards, UUID)
// =====================================================================

declare(strict_types=1);

require_once __DIR__ . '/db.php';

// ---- Session bootstrap ---------------------------------------------------
function start_session(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

// ---- JSON helpers --------------------------------------------------------
function json_response($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

function json_error(string $message, int $status = 400, array $extra = []): void {
    json_response(array_merge(['error' => $message], $extra), $status);
}

function read_json_body(): array {
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// ---- UUID v4 (RFC 4122) --------------------------------------------------
function uuid_v4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

// ---- Auth guards ---------------------------------------------------------
function current_user(): ?array {
    start_session();
    if (empty($_SESSION['user_id'])) return null;
    return [
        'id'    => $_SESSION['user_id'],
        'email' => $_SESSION['email'] ?? '',
        'role'  => $_SESSION['role']  ?? null,
        'department_id' => $_SESSION['department_id'] ?? null,
    ];
}

function require_auth(): array {
    $u = current_user();
    if (!$u) json_error('Unauthorized', 401);
    return $u;
}

function require_role(string ...$roles): array {
    $u = require_auth();
    if (!in_array($u['role'], $roles, true)) json_error('Forbidden', 403);
    return $u;
}

// ---- Audit + notification helpers ---------------------------------------
function audit(?string $actorId, ?string $appId, ?string $deptId, string $action, ?string $comments = null): void {
    $stmt = db()->prepare(
        'INSERT INTO audit_log (id, actor_id, application_id, department_id, action, comments)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([uuid_v4(), $actorId, $appId, $deptId, $action, $comments]);
}

function notify(string $userId, ?string $appId, string $title, ?string $body = null): void {
    $stmt = db()->prepare(
        'INSERT INTO notifications (id, user_id, application_id, title, body)
         VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([uuid_v4(), $userId, $appId, $title, $body]);
}

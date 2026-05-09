# Clearance — Legacy PHP / MySQL build

A vanilla PHP + MySQL re-implementation of the React/Supabase app for the
university course requirement. The Lovable React build remains intact.

## Phases

1. **Database** — `database_setup.sql` (run once in phpMyAdmin).
2. **Backend (PHP)** — JSON APIs under `api/` (this phase).
3. **Frontend** — `public/` HTML/CSS pulled from React build (next phase).
4. **Client JS** — Vanilla `fetch()` to call the PHP endpoints.

## Setup (XAMPP)

1. Copy this `legacy-php/` folder into `htdocs/uiu-clearance/`.
2. Start Apache + MySQL from the XAMPP control panel.
3. Open phpMyAdmin → import `database_setup.sql`.
4. Visit `http://localhost/uiu-clearance/` (frontend lands in Phase 3).

Default master-admin login (created by the seed):

    email:    admin@university.edu
    password: Admin@123

> The seed hash in `database_setup.sql` is a placeholder. Re-hash with
> `php -r "echo password_hash('Admin@123', PASSWORD_BCRYPT);"` and
> update the `users` row before logging in.

## API surface (Phase 2)

All endpoints accept/return JSON unless noted. Auth = PHP session cookie.

| Endpoint                                  | Method | Notes                                |
|-------------------------------------------|--------|--------------------------------------|
| `api/auth.php?action=signup`              | POST   | `{email,password,full_name,student_id?}` |
| `api/auth.php?action=login`               | POST   | `{email,password}`                   |
| `api/auth.php?action=logout`              | POST   |                                      |
| `api/auth.php?action=me`                  | GET    | Current session user + profile       |
| `api/applications.php?action=create`      | POST   | student                              |
| `api/applications.php?action=mine`        | GET    | student                              |
| `api/applications.php?action=list`        | GET    | dept_admin / master_admin            |
| `api/applications.php?action=detail&id=…` | GET    | student (own) / admin                |
| `api/departments.php?action=list`         | GET    | any auth                             |
| `api/departments.php?action=create`       | POST   | master_admin                         |
| `api/departments.php?action=update`       | POST   | master_admin                         |
| `api/departments.php?action=queue`        | GET    | dept_admin                           |
| `api/departments.php?action=review`       | POST   | dept_admin (approve/deny)            |
| `api/users.php?action=list`               | GET    | master_admin                         |
| `api/users.php?action=set_role`           | POST   | master_admin (cannot self-edit)      |
| `api/users.php?action=delete`             | POST   | master_admin (cannot self-delete)    |
| `api/notifications.php?action=list`       | GET    | any auth                             |
| `api/notifications.php?action=mark_read`  | POST   |                                      |
| `api/documents.php?action=upload`         | POST   | multipart/form-data                  |
| `api/documents.php?action=list`           | GET    |                                      |
| `api/documents.php?action=delete`         | POST   |                                      |

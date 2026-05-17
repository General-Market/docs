// The data room is single-tenant: one room, served at /room.
// The internal slug exists only to key the DB row and the session
// JWT — it never appears in any URL. If we ever go multi-tenant
// again, this is the seam to cut at.
export const ROOM_SLUG = 'main'

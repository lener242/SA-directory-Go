package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
)


func (h *Handler) GetAdminLog(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT l.id, COALESCE(u.username,'Панель'), l.action, l.table_name,
		       COALESCE(l.item_id,0), COALESCE(l.details,''),
		       to_char(l.created_at AT TIME ZONE 'UTC', 'DD.MM.YYYY HH24:MI')
		FROM admin_log l
		LEFT JOIN users u ON u.id = l.admin_id
		ORDER BY l.created_at DESC LIMIT 200`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	type LogEntry struct {
		ID        int    `json:"id"`
		Admin     string `json:"admin"`
		Action    string `json:"action"`
		Table     string `json:"table_name"`
		ItemID    int    `json:"item_id"`
		Details   string `json:"details"`
		CreatedAt string `json:"created_at"`
	}
	var logs []LogEntry
	for rows.Next() {
		var l LogEntry
		rows.Scan(&l.ID, &l.Admin, &l.Action, &l.Table, &l.ItemID, &l.Details, &l.CreatedAt)
		logs = append(logs, l)
	}
	if logs == nil {
		logs = []LogEntry{}
	}
	writeJSON(w, http.StatusOK, logs)
}

func (h *Handler) logAction(adminID int, action, table string, itemID int, details string) {
	if adminID == 0 {
		h.db.Exec(`INSERT INTO admin_log (action, table_name, item_id, details) VALUES ($1,$2,$3,$4)`,
			action, table, itemID, details)
	} else {
		h.db.Exec(`INSERT INTO admin_log (admin_id, action, table_name, item_id, details) VALUES ($1,$2,$3,$4,$5)`,
			adminID, action, table, itemID, details)
	}
}

func (h *Handler) GetUsers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		writeJSON(w, http.StatusOK, []struct{}{})
		return
	}
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, username, role,
		       to_char(created_at AT TIME ZONE 'UTC','DD.MM.YYYY'),
		       to_char(COALESCE(last_login, created_at) AT TIME ZONE 'UTC','DD.MM.YYYY HH24:MI')
		FROM users WHERE username ILIKE $1 ORDER BY id DESC LIMIT 20`, "%"+q+"%")
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	type U struct {
		ID        int    `json:"id"`
		Username  string `json:"username"`
		Role      string `json:"role"`
		CreatedAt string `json:"created_at"`
		LastLogin string `json:"last_login"`
	}
	var users []U
	for rows.Next() {
		var u U
		rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt, &u.LastLogin)
		users = append(users, u)
	}
	if users == nil { users = []U{} }
	writeJSON(w, http.StatusOK, users)
}

func (h *Handler) SetUserRole(w http.ResponseWriter, r *http.Request) {
	adminIDStr := r.Header.Get("X-User-ID")
	adminID, _ := strconv.Atoi(adminIDStr)

	var body struct {
		UserID int    `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if body.Role != "user" && body.Role != "moderator" && body.Role != "admin" {
		writeError(w, http.StatusBadRequest, "invalid role")
		return
	}

	_, err := h.db.ExecContext(r.Context(), `UPDATE users SET role=$1 WHERE id=$2`, body.Role, body.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.logAction(adminID, "update", "users", body.UserID, fmt.Sprintf("Set role=%s", body.Role))
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}


func (h *Handler) AdminCreateArticle(w http.ResponseWriter, r *http.Request) {
	adminID, _ := strconv.Atoi(r.Header.Get("X-User-ID"))
	var body models_ArticleJSON
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	var id int
	err := h.db.QueryRowContext(r.Context(),
		`INSERT INTO articles (section_id, group_name, article, stars, name, description,
		  full_desc, punishment, fine, has_conviction, jurisdiction, important)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
		body.SectionID, nullableStr(body.GroupName), nullableStr(body.Article),
		nullableStr(body.Stars), nullableStr(body.Name), nullableStr(body.Description),
		nullableStr(body.FullDesc), nullableStr(body.Punishment), nullableStr(body.Fine),
		body.HasConviction, nullableStr(body.Jurisdiction), nullableStr(body.Important),
	).Scan(&id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.logAction(adminID, "create", "articles", id, fmt.Sprintf("Created article %s - %s", body.Article, body.Name))
	body.ID = id
	writeJSON(w, http.StatusCreated, body)
}

func (h *Handler) AdminUpdateArticle(w http.ResponseWriter, r *http.Request) {
	adminID, _ := strconv.Atoi(r.Header.Get("X-User-ID"))
	idStr := r.URL.Query().Get("id")
	itemID, _ := strconv.Atoi(idStr)

	var body models_ArticleJSON
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	_, err := h.db.ExecContext(r.Context(),
		`UPDATE articles SET group_name=$1, article=$2, stars=$3, name=$4, description=$5,
		  full_desc=$6, punishment=$7, fine=$8, has_conviction=$9, jurisdiction=$10,
		  important=$11, updated_at=NOW() WHERE id=$12`,
		nullableStr(body.GroupName), nullableStr(body.Article), nullableStr(body.Stars),
		nullableStr(body.Name), nullableStr(body.Description), nullableStr(body.FullDesc),
		nullableStr(body.Punishment), nullableStr(body.Fine), body.HasConviction,
		nullableStr(body.Jurisdiction), nullableStr(body.Important), itemID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.logAction(adminID, "update", "articles", itemID, fmt.Sprintf("Updated article %s", body.Article))
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) AdminDeleteArticle(w http.ResponseWriter, r *http.Request) {
	adminID, _ := strconv.Atoi(r.Header.Get("X-User-ID"))
	idStr := r.URL.Query().Get("id")
	itemID, _ := strconv.Atoi(idStr)

	_, err := h.db.ExecContext(r.Context(), `DELETE FROM articles WHERE id=$1`, itemID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.logAction(adminID, "delete", "articles", itemID, fmt.Sprintf("Deleted article #%d", itemID))
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *Handler) AdminCreateInfo(w http.ResponseWriter, r *http.Request) {
	adminID, _ := strconv.Atoi(r.Header.Get("X-User-ID"))
	var body struct {
		SectionID   string          `json:"section_id"`
		Title       string          `json:"title"`
		Number      string          `json:"number"`
		Description string          `json:"description"`
		Items       json.RawMessage `json:"items"`
		WhoApplies  string          `json:"who_applies"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	items := body.Items
	if len(items) == 0 { items = json.RawMessage("[]") }

	var id int
	err := h.db.QueryRowContext(r.Context(),
		`INSERT INTO info_items (section_id, title, number, description, items, who_applies)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		body.SectionID, nullableStr(body.Title), nullableStr(body.Number),
		nullableStr(body.Description), items, nullableStr(body.WhoApplies),
	).Scan(&id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.logAction(adminID, "create", "info_items", id, fmt.Sprintf("Created info item: %s", body.Title))
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "status": "created"})
}

func (h *Handler) AdminUpdateInfo(w http.ResponseWriter, r *http.Request) {
	adminID, _ := strconv.Atoi(r.Header.Get("X-User-ID"))
	idStr := r.URL.Query().Get("id")
	itemID, _ := strconv.Atoi(idStr)

	var body struct {
		Title       string          `json:"title"`
		Number      string          `json:"number"`
		Description string          `json:"description"`
		Items       json.RawMessage `json:"items"`
		WhoApplies  string          `json:"who_applies"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	items := body.Items
	if len(items) == 0 { items = json.RawMessage("[]") }

	_, err := h.db.ExecContext(r.Context(),
		`UPDATE info_items SET title=$1, number=$2, description=$3, items=$4, who_applies=$5, updated_at=NOW() WHERE id=$6`,
		nullableStr(body.Title), nullableStr(body.Number), nullableStr(body.Description),
		items, nullableStr(body.WhoApplies), itemID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.logAction(adminID, "update", "info_items", itemID, fmt.Sprintf("Updated info item #%d", itemID))
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) AdminDeleteInfo(w http.ResponseWriter, r *http.Request) {
	adminID, _ := strconv.Atoi(r.Header.Get("X-User-ID"))
	idStr := r.URL.Query().Get("id")
	itemID, _ := strconv.Atoi(idStr)

	_, err := h.db.ExecContext(r.Context(), `DELETE FROM info_items WHERE id=$1`, itemID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.logAction(adminID, "delete", "info_items", itemID, fmt.Sprintf("Deleted info item #%d", itemID))
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

type models_ArticleJSON = struct {
	ID            int    `json:"id"`
	SectionID     string `json:"section_id"`
	GroupName     string `json:"group_name,omitempty"`
	Article       string `json:"article,omitempty"`
	Stars         string `json:"stars,omitempty"`
	Name          string `json:"name,omitempty"`
	Description   string `json:"description,omitempty"`
	FullDesc      string `json:"full_desc,omitempty"`
	Punishment    string `json:"punishment,omitempty"`
	Fine          string `json:"fine,omitempty"`
	HasConviction bool   `json:"has_conviction"`
	Jurisdiction  string `json:"jurisdiction,omitempty"`
	Important     string `json:"important,omitempty"`
}

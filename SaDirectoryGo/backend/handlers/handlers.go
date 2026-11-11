package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"sanandreas/models"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	db *sql.DB
}

func New(db *sql.DB) *Handler {
	return &Handler{db: db}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}


func (h *Handler) GetSections(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, title, icon, group_name, has_filters, sort_order
		 FROM sections ORDER BY sort_order`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var sections []models.Section
	for rows.Next() {
		var s models.Section
		if err := rows.Scan(&s.ID, &s.Title, &s.Icon, &s.GroupName, &s.HasFilters, &s.SortOrder); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sections = append(sections, s)
	}
	writeJSON(w, http.StatusOK, sections)
}


func (h *Handler) GetArticles(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	section := q.Get("section")
	filter := q.Get("filter")
	search := q.Get("q")

	query := `SELECT id, section_id, group_name, article, stars, name,
	           description, full_desc, punishment, fine, has_conviction,
	           jurisdiction, important, created_at, updated_at
	          FROM articles WHERE 1=1`
	args := []any{}
	idx := 1

	if section != "" {
		query += ` AND section_id = $` + strconv.Itoa(idx)
		args = append(args, section)
		idx++
	}
	if filter == "sud" {
		query += ` AND has_conviction = true`
	} else if filter == "sh" {
		query += ` AND fine IS NOT NULL AND fine != ''`
	} else if filter == "5star" {
		query += ` AND stars = '⭐⭐⭐⭐⭐'`
	}
	if search != "" {
		query += ` AND (name ILIKE $` + strconv.Itoa(idx) +
			` OR article ILIKE $` + strconv.Itoa(idx) +
			` OR description ILIKE $` + strconv.Itoa(idx) + `)`
		args = append(args, "%"+search+"%")
		idx++
	}
	query += ` ORDER BY id`

	rows, err := h.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var articles []models.ArticleJSON
	for rows.Next() {
		var a models.Article
		err := rows.Scan(&a.ID, &a.SectionID, &a.GroupName, &a.Article, &a.Stars,
			&a.Name, &a.Description, &a.FullDesc, &a.Punishment, &a.Fine,
			&a.HasConviction, &a.Jurisdiction, &a.Important, &a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		articles = append(articles, a.ToJSON())
	}
	writeJSON(w, http.StatusOK, articles)
}

func (h *Handler) GetArticleByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var a models.Article
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id, section_id, group_name, article, stars, name,
		        description, full_desc, punishment, fine, has_conviction,
		        jurisdiction, important, created_at, updated_at
		 FROM articles WHERE id = $1`, id).
		Scan(&a.ID, &a.SectionID, &a.GroupName, &a.Article, &a.Stars,
			&a.Name, &a.Description, &a.FullDesc, &a.Punishment, &a.Fine,
			&a.HasConviction, &a.Jurisdiction, &a.Important, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, a.ToJSON())
}

func (h *Handler) CreateArticle(w http.ResponseWriter, r *http.Request) {
	var body models.ArticleJSON
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
	body.ID = id
	writeJSON(w, http.StatusCreated, body)
}

func (h *Handler) UpdateArticle(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body models.ArticleJSON
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
		nullableStr(body.Jurisdiction), nullableStr(body.Important), id,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) DeleteArticle(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, err := h.db.ExecContext(r.Context(), `DELETE FROM articles WHERE id=$1`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}


func (h *Handler) GetInfoItems(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	section := q.Get("section")
	search := q.Get("q")

	query := `SELECT id, section_id, title, number, description, items, who_applies, created_at, updated_at
	          FROM info_items WHERE 1=1`
	args := []any{}
	idx := 1

	if section != "" {
		query += ` AND section_id = $` + strconv.Itoa(idx)
		args = append(args, section)
		idx++
	}
	if search != "" {
		query += ` AND (title ILIKE $` + strconv.Itoa(idx) +
			` OR description ILIKE $` + strconv.Itoa(idx) + `)`
		args = append(args, "%"+search+"%")
	}
	query += ` ORDER BY id`

	rows, err := h.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var items []models.InfoItemJSON
	for rows.Next() {
		var item models.InfoItem
		err := rows.Scan(&item.ID, &item.SectionID, &item.Title, &item.Number,
			&item.Description, &item.Items, &item.WhoApplies, &item.CreatedAt, &item.UpdatedAt)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		items = append(items, item.ToJSON())
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *Handler) GetInfoItemByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var item models.InfoItem
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id, section_id, title, number, description, items, who_applies, created_at, updated_at
		 FROM info_items WHERE id=$1`, id).
		Scan(&item.ID, &item.SectionID, &item.Title, &item.Number,
			&item.Description, &item.Items, &item.WhoApplies, &item.CreatedAt, &item.UpdatedAt)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, item.ToJSON())
}

func (h *Handler) CreateInfoItem(w http.ResponseWriter, r *http.Request) {
	var body models.InfoItemJSON
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	var id int
	err := h.db.QueryRowContext(r.Context(),
		`INSERT INTO info_items (section_id, title, number, description, items, who_applies)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		body.SectionID, nullableStr(body.Title), nullableStr(body.Number),
		nullableStr(body.Description), body.Items, nullableStr(body.WhoApplies),
	).Scan(&id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	body.ID = id
	writeJSON(w, http.StatusCreated, body)
}

func (h *Handler) UpdateInfoItem(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body models.InfoItemJSON
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	_, err := h.db.ExecContext(r.Context(),
		`UPDATE info_items SET title=$1, number=$2, description=$3, items=$4,
		  who_applies=$5, updated_at=NOW() WHERE id=$6`,
		nullableStr(body.Title), nullableStr(body.Number), nullableStr(body.Description),
		body.Items, nullableStr(body.WhoApplies), id,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) DeleteInfoItem(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, err := h.db.ExecContext(r.Context(), `DELETE FROM info_items WHERE id=$1`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}


func (h *Handler) GlobalSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		writeJSON(w, http.StatusOK, []any{})
		return
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, section_id, section_title, item_type, code, title,
		       description, punishment, fine, has_conviction, stars, important, items
		FROM search_all
		WHERE title ILIKE $1
		   OR description ILIKE $1
		   OR code ILIKE $1
		   OR important ILIKE $1
		LIMIT 100
	`, "%"+q+"%")
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var results []models.SearchResult
	for rows.Next() {
		var sr models.SearchResult
		var code, title, desc, punishment, fine, stars, important sql.NullString
		var hasConv sql.NullBool
		var rawItems []byte
		err := rows.Scan(&sr.ID, &sr.SectionID, &sr.SectionTitle, &sr.ItemType,
			&code, &title, &desc, &punishment, &fine, &hasConv, &stars, &important, &rawItems)
		if err != nil {
			continue 
		}
		sr.Code = code.String
		sr.Title = title.String
		sr.Description = desc.String
		sr.Punishment = punishment.String
		sr.Fine = fine.String
		sr.Stars = stars.String
		sr.Important = important.String
		if hasConv.Valid {
			sr.HasConviction = hasConv.Bool
		}
		if rawItems != nil {
			sr.Items = rawItems
		}
		results = append(results, sr)
	}
	if rows.Err() != nil {
		writeError(w, http.StatusInternalServerError, rows.Err().Error())
		return
	}
	if results == nil {
		results = []models.SearchResult{}
	}
	writeJSON(w, http.StatusOK, results)
}

func nullableStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}


type FavItem struct {
	ID        int    `json:"id"`
	UserID    string `json:"user_id"`
	ItemType  string `json:"item_type"`
	ItemID    int    `json:"item_id"`
	SortOrder int    `json:"sort_order"`
}

func (h *Handler) GetFavourites(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		writeError(w, http.StatusBadRequest, "user_id required")
		return
	}
	rows, err := h.db.QueryContext(r.Context(),
		`SELECT f.id, f.user_id, f.item_type, f.item_id, f.sort_order,
		        COALESCE(a.section_id,''), COALESCE(a.article,''), COALESCE(a.name,''),
		        COALESCE(a.description,''), COALESCE(a.punishment,''), COALESCE(a.fine,''),
		        a.has_conviction, COALESCE(a.stars,''), COALESCE(a.important,''),
		        COALESCE(i.section_id,''), COALESCE(i.title,''), COALESCE(i.number,''),
		        COALESCE(i.description,''), COALESCE(i.items::text,'[]')
		 FROM favourites f
		 LEFT JOIN articles a ON f.item_type='article' AND f.item_id=a.id
		 LEFT JOIN info_items i ON f.item_type='info' AND f.item_id=i.id
		 WHERE f.user_id=$1 ORDER BY f.sort_order, f.id`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	type FavFull struct {
		FavID     int    `json:"fav_id"`
		ItemType  string `json:"item_type"`
		ItemID    int    `json:"item_id"`
		SortOrder int    `json:"sort_order"`
		SectionID string `json:"section_id"`
		Article   string `json:"article,omitempty"`
		Name      string `json:"name"`
		Desc      string `json:"description,omitempty"`
		Punishment string `json:"punishment,omitempty"`
		Fine      string `json:"fine,omitempty"`
		HasConv   bool   `json:"has_conviction"`
		Stars     string `json:"stars,omitempty"`
		Important string `json:"important,omitempty"`
		Items     string `json:"items,omitempty"`
	}

	var result []FavFull
	for rows.Next() {
		var f FavFull
		var uid string
		var aSec, aArt, aName, aDesc, aPun, aFine, aStars, aImp string
		var aConv sql.NullBool
		var iSec, iTitle, iNum, iDesc, iItems string
		err := rows.Scan(&f.FavID, &uid, &f.ItemType, &f.ItemID, &f.SortOrder,
			&aSec, &aArt, &aName, &aDesc, &aPun, &aFine, &aConv, &aStars, &aImp,
			&iSec, &iTitle, &iNum, &iDesc, &iItems)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if f.ItemType == "article" {
			f.SectionID = aSec; f.Article = aArt; f.Name = aName
			f.Desc = aDesc; f.Punishment = aPun; f.Fine = aFine
			f.Stars = aStars; f.Important = aImp
			if aConv.Valid { f.HasConv = aConv.Bool }
		} else {
			f.SectionID = iSec
			if iTitle != "" { f.Name = iTitle } else { f.Name = iNum }
			f.Desc = iDesc; f.Items = iItems
		}
		result = append(result, f)
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) AddFavourite(w http.ResponseWriter, r *http.Request) {
	var body FavItem
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	var maxOrder int
	h.db.QueryRowContext(r.Context(),
		`SELECT COALESCE(MAX(sort_order),0) FROM favourites WHERE user_id=$1`, body.UserID).Scan(&maxOrder)

	var id int
	err := h.db.QueryRowContext(r.Context(),
		`INSERT INTO favourites (user_id, item_type, item_id, sort_order)
		 VALUES ($1,$2,$3,$4) ON CONFLICT (user_id,item_type,item_id) DO NOTHING RETURNING id`,
		body.UserID, body.ItemType, body.ItemID, maxOrder+1).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]string{"status": "already_exists"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"status": "added", "id": id})
}

func (h *Handler) RemoveFavourite(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	itemType := r.URL.Query().Get("item_type")
	itemID := r.URL.Query().Get("item_id")
	_, err := h.db.ExecContext(r.Context(),
		`DELETE FROM favourites WHERE user_id=$1 AND item_type=$2 AND item_id=$3`,
		userID, itemType, itemID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

func (h *Handler) ReorderFavourites(w http.ResponseWriter, r *http.Request) {
	var body []struct {
		FavID     int `json:"fav_id"`
		SortOrder int `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	for _, item := range body {
		h.db.ExecContext(r.Context(),
			`UPDATE favourites SET sort_order=$1 WHERE id=$2`, item.SortOrder, item.FavID)
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "reordered"})
}

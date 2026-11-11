package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"
)


type spamEntry struct {
	count     int
	firstMsg  time.Time
	blockedAt time.Time
}

var (
	spamMu      sync.Mutex
	spamTracker = map[int]*spamEntry{} 
)

const (
	spamWindow   = 10 * time.Second 
	spamMaxMsgs  = 5                
	spamBlockDur = 1 * time.Hour    
)

func checkSpam(userID int) (blocked bool, remaining time.Duration) {
	spamMu.Lock()
	defer spamMu.Unlock()

	now := time.Now()
	e, ok := spamTracker[userID]
	if !ok {
		spamTracker[userID] = &spamEntry{count: 1, firstMsg: now}
		return false, 0
	}

	if !e.blockedAt.IsZero() {
		until := e.blockedAt.Add(spamBlockDur)
		if now.Before(until) {
			return true, until.Sub(now)
		}
		e.blockedAt = time.Time{}
		e.count = 1
		e.firstMsg = now
		return false, 0
	}

	if now.Sub(e.firstMsg) > spamWindow {
		e.count = 1
		e.firstMsg = now
		return false, 0
	}

	e.count++
	if e.count > spamMaxMsgs {
		e.blockedAt = now
		return true, spamBlockDur
	}
	return false, 0
}


type ChatMessage struct {
	ID        int    `json:"id"`
	UserID    int    `json:"user_id"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	Message   string `json:"message"`
	CreatedAt string `json:"created_at"`
}

func (h *Handler) GetChat(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT m.id, m.user_id, u.username, u.role, m.message,
		       to_char(m.created_at AT TIME ZONE 'Europe/Moscow', 'DD.MM HH24:MI') as created_at
		FROM chat_messages m
		JOIN users u ON u.id = m.user_id
		WHERE m.deleted = false
		ORDER BY m.created_at DESC
		LIMIT 100`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var msgs []ChatMessage
	for rows.Next() {
		var m ChatMessage
		if err := rows.Scan(&m.ID, &m.UserID, &m.Username, &m.Role, &m.Message, &m.CreatedAt); err != nil {
			continue
		}
		msgs = append(msgs, m)
	}
	if msgs == nil {
		msgs = []ChatMessage{}
	}
	writeJSON(w, http.StatusOK, msgs)
}

func (h *Handler) PostChat(w http.ResponseWriter, r *http.Request) {
	claims := optionalAuth(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "Нужно войти в аккаунт")
		return
	}

	blocked, remaining := checkSpam(claims.UserID)
	if blocked {
		mins := int(remaining.Minutes())
		writeError(w, http.StatusTooManyRequests,
			fmt.Sprintf("Вы заблокированы за спам на %d мин. %d сек.", mins, int(remaining.Seconds())%60))
		return
	}

	var body struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	msg := []rune(body.Message)
	if len(msg) < 1 || len(msg) > 500 {
		writeError(w, http.StatusBadRequest, "Сообщение: от 1 до 500 символов")
		return
	}

	var id int
	err := h.db.QueryRowContext(r.Context(),
		`INSERT INTO chat_messages (user_id, message) VALUES ($1, $2) RETURNING id`,
		claims.UserID, body.Message).Scan(&id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "status": "sent"})
}

func (h *Handler) DeleteChatMessage(w http.ResponseWriter, r *http.Request) {
	var deleterID int
	var deleterName string

	if r.Header.Get("X-Admin-Secret") == getAdminSecret() {
		deleterID = 0
		deleterName = "Панель"
	} else {
		claims := optionalAuth(r)
		if claims == nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		if claims.Role != "moderator" && claims.Role != "admin" {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
		deleterID = claims.UserID
		deleterName = claims.Username
	}

	idStr := r.URL.Query().Get("id")
	msgID, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	var deletedByVal interface{}
	if deleterID > 0 {
		deletedByVal = deleterID
	} else {
		deletedByVal = nil
	}

	_, err = h.db.ExecContext(r.Context(),
		`UPDATE chat_messages SET deleted=true, deleted_by=$1 WHERE id=$2`,
		deletedByVal, msgID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.db.ExecContext(r.Context(),
		`INSERT INTO admin_log (admin_id, action, table_name, item_id, details) VALUES ($1,'delete','chat_messages',$2,$3)`,
		deletedByVal, msgID, fmt.Sprintf("Chat message #%d deleted by %s", msgID, deleterName))

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

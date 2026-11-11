package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret = []byte(getJWTSecret())

func getJWTSecret() string {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return s
	}
	return "sa_law_ref_secret_2024_x9k2"
}

type Claims struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

type UserInfo struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

func makeToken(user UserInfo) (string, error) {
	claims := Claims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret)
}

func ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, err
	}
	return token.Claims.(*Claims), nil
}

func optionalAuth(r *http.Request) *Claims {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return nil
	}
	claims, err := ParseToken(strings.TrimPrefix(auth, "Bearer "))
	if err != nil {
		return nil
	}
	return claims
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		claims, err := ParseToken(strings.TrimPrefix(auth, "Bearer "))
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid token")
			return
		}
		r.Header.Set("X-User-ID", fmt.Sprintf("%d", claims.UserID))
		r.Header.Set("X-Username", claims.Username)
		r.Header.Set("X-Role", claims.Role)
		next.ServeHTTP(w, r)
	})
}

func ModeratorMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role := r.Header.Get("X-Role")
		if role != "moderator" && role != "admin" {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func AdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Accept either: admin role JWT OR secret header
		if r.Header.Get("X-Admin-Secret") == getAdminSecret() {
			// Secret key access - set fake admin headers
			r.Header.Set("X-User-ID", "0")
			r.Header.Set("X-Username", "admin")
			r.Header.Set("X-Role", "admin")
			next.ServeHTTP(w, r)
			return
		}
		if r.Header.Get("X-Role") == "admin" {
			next.ServeHTTP(w, r)
			return
		}
		writeError(w, http.StatusForbidden, "forbidden")
	})
}

func getAdminSecret() string {
	if s := os.Getenv("ADMIN_SECRET"); s != "" {
		return s
	}
	return "FA100_secret_header_9x2k"
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	ip := realIP(r)
	var count int
	h.db.QueryRowContext(r.Context(),
		`SELECT COUNT(*) FROM reg_attempts WHERE ip=$1 AND created_at > NOW()-INTERVAL '24 hours'`, ip).Scan(&count)
	if count >= 3 {
		writeError(w, http.StatusTooManyRequests, "С этого IP уже создано 3 аккаунта за 24 часа")
		return
	}

	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	body.Username = strings.TrimSpace(body.Username)
	if len(body.Username) < 3 || len(body.Username) > 32 {
		writeError(w, http.StatusBadRequest, "Логин: от 3 до 32 символов")
		return
	}
	for _, c := range body.Username {
		if !unicode.IsLetter(c) && !unicode.IsDigit(c) && c != '_' {
			writeError(w, http.StatusBadRequest, "Логин: только буквы, цифры и _")
			return
		}
	}
	if len(body.Password) < 6 {
		writeError(w, http.StatusBadRequest, "Пароль: минимум 6 символов")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "hash error")
		return
	}

	var userID int
	err = h.db.QueryRowContext(r.Context(),
		`INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id`,
		body.Username, string(hash)).Scan(&userID)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			writeError(w, http.StatusConflict, "Логин уже занят")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.db.ExecContext(r.Context(), `INSERT INTO reg_attempts (ip) VALUES ($1)`, ip)

	user := UserInfo{ID: userID, Username: body.Username, Role: "user"}
	token, _ := makeToken(user)
	writeJSON(w, http.StatusCreated, map[string]any{"token": token, "user": user})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	var user UserInfo
	var hash string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id, username, role, password_hash FROM users WHERE username=$1`,
		strings.TrimSpace(body.Username)).Scan(&user.ID, &user.Username, &user.Role, &hash)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusUnauthorized, "Неверный логин или пароль")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "Неверный логин или пароль")
		return
	}

	h.db.ExecContext(r.Context(), `UPDATE users SET last_login=NOW() WHERE id=$1`, user.ID)
	token, _ := makeToken(user)
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": user})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	claims, err := ParseToken(strings.TrimPrefix(auth, "Bearer "))
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid token")
		return
	}
	writeJSON(w, http.StatusOK, UserInfo{ID: claims.UserID, Username: claims.Username, Role: claims.Role})
}

func realIP(r *http.Request) string {
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return strings.Split(ip, ",")[0]
	}
	return r.RemoteAddr
}

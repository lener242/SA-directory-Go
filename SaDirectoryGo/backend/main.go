package main

import (
	"log"
	"net/http"
	"os"

	"sanandreas/db"
	"sanandreas/handlers"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	database, err := db.Connect()
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer database.Close()

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Compress(5))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Content-Type", "Authorization"},
	}))

	h := handlers.New(database)

	r.Route("/api", func(r chi.Router) {
		r.Post("/register", h.Register)
		r.Post("/login", h.Login)
		r.Get("/me", h.Me)

		r.Get("/sections", h.GetSections)
		r.Get("/articles", h.GetArticles)
		r.Get("/articles/{id}", h.GetArticleByID)
		r.Get("/info", h.GetInfoItems)
		r.Get("/info/{id}", h.GetInfoItemByID)
		r.Get("/search", h.GlobalSearch)

		r.Get("/favourites", h.GetFavourites)
		r.Post("/favourites", h.AddFavourite)
		r.Delete("/favourites", h.RemoveFavourite)
		r.Put("/favourites/reorder", h.ReorderFavourites)

		r.Get("/chat", h.GetChat)
		r.Post("/chat", h.PostChat)

		r.Delete("/chat/message", h.DeleteChatMessage)

		r.Group(func(r chi.Router) {
			r.Use(handlers.AdminMiddleware)
			r.Get("/admin/log", h.GetAdminLog)
			r.Get("/admin/users", h.GetUsers)
			r.Post("/admin/users/role", h.SetUserRole)
			r.Post("/admin/articles", h.AdminCreateArticle)
			r.Put("/admin/articles", h.AdminUpdateArticle)
			r.Delete("/admin/articles", h.AdminDeleteArticle)
			r.Post("/admin/info", h.AdminCreateInfo)
			r.Put("/admin/info", h.AdminUpdateInfo)
			r.Delete("/admin/info", h.AdminDeleteInfo)
		})
	})

	fs := http.FileServer(http.Dir("./static"))
	r.Handle("/*", fs)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	log.Printf("🚀 San Andreas API running on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

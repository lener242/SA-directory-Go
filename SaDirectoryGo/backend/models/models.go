package models

import (
	"database/sql"
	"encoding/json"
	"time"
)

type Section struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Icon       string `json:"icon"`
	GroupName  string `json:"group_name"`
	HasFilters bool   `json:"has_filters"`
	SortOrder  int    `json:"sort_order"`
}

type Article struct {
	ID            int            `json:"id"`
	SectionID     string         `json:"section_id"`
	GroupName     sql.NullString `json:"group_name"`
	Article       sql.NullString `json:"article"`
	Stars         sql.NullString `json:"stars"`
	Name          sql.NullString `json:"name"`
	Description   sql.NullString `json:"description"`
	FullDesc      sql.NullString `json:"full_desc"`
	Punishment    sql.NullString `json:"punishment"`
	Fine          sql.NullString `json:"fine"`
	HasConviction bool           `json:"has_conviction"`
	Jurisdiction  sql.NullString `json:"jurisdiction"`
	Important     sql.NullString `json:"important"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

type ArticleJSON struct {
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

func (a *Article) ToJSON() ArticleJSON {
	return ArticleJSON{
		ID:            a.ID,
		SectionID:     a.SectionID,
		GroupName:     nullStr(a.GroupName),
		Article:       nullStr(a.Article),
		Stars:         nullStr(a.Stars),
		Name:          nullStr(a.Name),
		Description:   nullStr(a.Description),
		FullDesc:      nullStr(a.FullDesc),
		Punishment:    nullStr(a.Punishment),
		Fine:          nullStr(a.Fine),
		HasConviction: a.HasConviction,
		Jurisdiction:  nullStr(a.Jurisdiction),
		Important:     nullStr(a.Important),
	}
}

type InfoItem struct {
	ID          int             `json:"id"`
	SectionID   string          `json:"section_id"`
	Title       sql.NullString  `json:"title"`
	Number      sql.NullString  `json:"number"`
	Description sql.NullString  `json:"description"`
	Items       json.RawMessage `json:"items"`
	WhoApplies  sql.NullString  `json:"who_applies"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type InfoItemJSON struct {
	ID          int             `json:"id"`
	SectionID   string          `json:"section_id"`
	Title       string          `json:"title,omitempty"`
	Number      string          `json:"number,omitempty"`
	Description string          `json:"description,omitempty"`
	Items       json.RawMessage `json:"items"`
	WhoApplies  string          `json:"who_applies,omitempty"`
}

func (i *InfoItem) ToJSON() InfoItemJSON {
	return InfoItemJSON{
		ID:          i.ID,
		SectionID:   i.SectionID,
		Title:       nullStr(i.Title),
		Number:      nullStr(i.Number),
		Description: nullStr(i.Description),
		Items:       i.Items,
		WhoApplies:  nullStr(i.WhoApplies),
	}
}

type SearchResult struct {
	ID            int             `json:"id"`
	SectionID     string          `json:"section_id"`
	SectionTitle  string          `json:"section_title"`
	ItemType      string          `json:"item_type"`
	Code          string          `json:"code,omitempty"`
	Title         string          `json:"title,omitempty"`
	Description   string          `json:"description,omitempty"`
	Punishment    string          `json:"punishment,omitempty"`
	Fine          string          `json:"fine,omitempty"`
	HasConviction bool            `json:"has_conviction"`
	Stars         string          `json:"stars,omitempty"`
	Important     string          `json:"important,omitempty"`
	Items         json.RawMessage `json:"items,omitempty"`
}

func nullStr(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

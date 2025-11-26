package handlers

import (
	"gcp-access-visualizer/internal/gcp"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler holds dependencies for HTTP handlers
type Handler struct {
	gcpClient *gcp.Client
}

// NewHandler creates a new handler
func NewHandler(gcpClient *gcp.Client) *Handler {
	return &Handler{
		gcpClient: gcpClient,
	}
}

// GetUsers handles GET /api/users
func (h *Handler) GetUsers(c *gin.Context) {
	users, err := h.gcpClient.GetUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, users)
}

// GetResources handles GET /api/resources
func (h *Handler) GetResources(c *gin.Context) {
	resources, err := h.gcpClient.GetResources()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resources)
}

// GetAccess handles GET /api/access
func (h *Handler) GetAccess(c *gin.Context) {
	accessMatrix, err := h.gcpClient.GetAccessMatrix()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, accessMatrix)
}

// HealthCheck handles GET /api/health
func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "gcp-access-visualizer",
	})
}

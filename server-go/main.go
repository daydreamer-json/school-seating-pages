package main

import (
    "bufio"
    "context"
    "fmt"
    "log"
    "net"
    "net/http"
    "os"
    "os/exec"
    "path/filepath"
    "regexp"
    "runtime"
    "strings"
    "time"
)

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        requestPath := r.URL.Path
        normalizedPath := strings.TrimLeft(requestPath, "/")
        re := regexp.MustCompile(`/+`)
        normalizedPath = re.ReplaceAllString(normalizedPath, "/")
        if strings.HasSuffix(requestPath, "/") {
            normalizedPath += "/index.html"
        }
        filePath := filepath.Join(".", normalizedPath)

        fileInfo, err := os.Stat(filePath)
        if err == nil {
            if !fileInfo.Mode().IsRegular() {
                http.NotFound(w, r)
                return
            }
            file, err := os.Open(filePath)
            if err != nil {
                log.Printf("Error serving file: %v", err)
                http.Error(w, "Internal Server Error", http.StatusInternalServerError)
                return
            }
            defer file.Close()
            http.ServeContent(w, r, filePath, fileInfo.ModTime(), file)
        } else {
            log.Printf("Requested file not found: %s", requestPath)
            http.NotFound(w, r)
        }
    })

    ln, err := net.Listen("tcp", ":0")
    if err != nil {
        log.Fatal(err)
    }
    defer ln.Close()

    port := ln.Addr().(*net.TCPAddr).Port
    fmt.Printf("HTTP server running at http://localhost:%d\n", port)

    server := &http.Server{Handler: mux}

    go func() {
        if err := server.Serve(ln); err != nil && err != http.ErrServerClosed {
            log.Fatalf("Failed to serve: %v", err)
        }
    }()

    url := fmt.Sprintf("http://localhost:%d/src/index.html", port)
    openBrowser(url)

    fmt.Println("Press Enter to close the server ...")
    bufio.NewScanner(os.Stdin).Scan()

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    if err := server.Shutdown(ctx); err != nil {
        log.Fatalf("Failed to shut down server: %v", err)
    }
}

func openBrowser(url string) {
    var cmd *exec.Cmd
    switch runtime.GOOS {
    case "linux":
        cmd = exec.Command("xdg-open", url)
    case "darwin":
        cmd = exec.Command("open", url)
    case "windows":
        cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
    default:
        log.Printf("Unsupported platform, cannot open browser")
        return
    }
    err := cmd.Start()
    if err != nil {
        log.Printf("Failed to open browser: %v", err)
    }
}
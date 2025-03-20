import json
import base64
import toga
import threading
import http.server
import socketserver
import urllib.request
import os
import shutil
import mimetypes
from pathlib import Path

API_URL = 'https://api.npoint.io/b76a756aa6769b16cbdb'

class CombinedRequestHandler(http.server.SimpleHTTPRequestHandler):
    """
    Jeden handler obsługujący:
      - /update-data (pobieranie z API, zapis do cache)
      - /data (odczyt z cache)
      - statyczne pliki (index.html, script.js, style.css) przez super().do_GET()
    """
    def do_GET(self):
        # Gdy żądanie to /update-data
        if self.path == '/update-data':
            self.handle_update_data()
        # Gdy żądanie to /data
        elif self.path == '/data':
            self.handle_read_data()
        # Gdy żądanie to / lub /index.html, chcemy serwować index.html
        elif self.path == '/' or self.path == '/index.html':
            self.path = '/index.html'
            super().do_GET()
        else:
            # Pozostałe pliki (script.js, style.css, favicon.ico itp.)
            super().do_GET()

    def handle_update_data(self):
        """Obsługa pobierania danych z API i zapisu do cache z konwersją obrazów na base64."""
        try:
            with urllib.request.urlopen(API_URL, timeout=5) as response:
                new_data = response.read()
            if not new_data.strip():
                raise Exception("Empty API response")

            data_obj = json.loads(new_data.decode('utf-8'))
            # Konwersja obrazów
            if "events" in data_obj:
                for event in data_obj["events"]:
                    if "image" in event and event["image"]:
                        image_url = event["image"]
                        try:
                            with urllib.request.urlopen(image_url, timeout=5) as img_response:
                                img_data = img_response.read()
                            content_type = img_response.info().get_content_type() or "image/jpeg"
                            encoded_str = base64.b64encode(img_data).decode('utf-8')
                            event["image"] = f"data:{content_type};base64,{encoded_str}"
                            print("[DEBUG] Encoded image from", image_url)
                        except Exception as img_err:
                            print("[DEBUG] Error downloading image:", img_err)
                            event["image"] = ""

            # Zapis do cache
            final_data = json.dumps(data_obj).encode('utf-8')
            with open(self.server.cache_file, 'wb') as f:
                f.write(final_data)
            print("[INFO] /update-data: Dane pobrane i zapisane do cache (base64).")

            # Odpowiedź
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(final_data)
        except Exception as e:
            print("[ERROR] Update failed:", e)
            self.send_error(500, "Update failed: " + str(e))

    def handle_read_data(self):
        """Obsługa odczytu danych z cache (/data)."""
        cache_path = self.server.cache_file
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'rb') as f:
                    cached_data = f.read()
                if not cached_data.strip():
                    raise Exception("Cache is empty")

                print("[INFO] /data: Zwracam dane z cache.")
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(cached_data)
            except Exception as e:
                print("[ERROR] reading cache:", e)
                self.send_error(500, "Error reading cache: " + str(e))
        else:
            print("[ERROR] No cache file found.")
            self.send_error(404, "No cache file found.")


class SportsResultsApp(toga.App):
    def startup(self):
        static_dir = Path(__file__).parent
        cache_file = os.path.join(self.paths.data, "cache.json")
        print("[INFO] Cache file path:", cache_file)
        os.makedirs(self.paths.data, exist_ok=True)

        # Tworzymy serwer
        # -> directory=static_dir pozwala serwować index.html, script.js itp.
        handler_class = lambda *args, directory=static_dir, **kwargs: \
            CombinedRequestHandler(*args, directory=directory, **kwargs)

        # Uruchamiamy serwer na 127.0.0.1, port=0 (losowy)
        self.httpd = socketserver.TCPServer(("127.0.0.1", 0), handler_class)
        port = self.httpd.server_address[1]
        self.httpd.cache_file = cache_file  # do przechowywania ścieżki cache
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

        local_url = f"http://127.0.0.1:{port}/index.html"
        print("[INFO] Serwer wystartował na", local_url)

        # WebView ładuje index.html
        webview = toga.WebView(url=local_url)
        self.main_window = toga.MainWindow(title=self.formal_name)
        self.main_window.content = webview
        self.main_window.show()

    def on_exit(self):
        try:
            self.httpd.shutdown()
        except Exception as e:
            print("Błąd wyłączania serwera:", e)
        return True

def main():
    return SportsResultsApp("Sports Results", "org.example.sportsresults")

if __name__ == "__main__":
    main().main_loop()

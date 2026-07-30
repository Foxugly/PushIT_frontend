import { Component, computed, inject, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';

import { ConsoleCopyService } from '../../../../core/services/console-copy.service';

export interface CodeExample {
  key: string;
  label: string;
  code: string;
}

/**
 * Ready-to-copy send examples, one per language.
 *
 * Two rules the snippets never break:
 *
 * 1. **The token comes from the environment** (`PUSHIT_TOKEN`), never inline.
 *    That is what good documentation does, and it avoids the gesture that leaks
 *    secrets: pasting the snippet as-is into a repository. The application id is
 *    written in plain — it isn't secret.
 * 2. **They target the send token, never the enrolment code.** An example that
 *    got this wrong would reintroduce the flaw through the documentation.
 */
@Component({
  selector: 'app-code-examples',
  imports: [ButtonModule, TabsModule, TooltipModule],
  templateUrl: './code-examples.html',
  styleUrl: './code-examples.scss',
})
export class CodeExamples {
  private readonly consoleCopy = inject(ConsoleCopyService);

  /** Base URL of the API, e.g. `https://pushit-api.foxugly.com/api/v1`. */
  readonly apiBaseUrl = input.required<string>();

  readonly copy = computed(() => this.consoleCopy.current().codeExamples);
  readonly activeTab = signal('curl');
  readonly copied = signal<string | null>(null);

  readonly examples = computed<CodeExample[]>(() => {
    const url = `${this.apiBaseUrl()}/notifications/app/send/`;
    return [
      { key: 'curl', label: 'curl', code: curlExample(url) },
      { key: 'python', label: 'Python', code: pythonExample(url) },
      { key: 'go', label: 'Go', code: goExample(url) },
      { key: 'ruby', label: 'Ruby', code: rubyExample(url) },
      { key: 'java', label: 'Java', code: javaExample(url) },
      { key: 'c', label: 'C', code: cExample(url) },
      { key: 'cpp', label: 'C++', code: cppExample(url) },
    ];
  });

  async copyExample(example: CodeExample): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(example.code);
      } else {
        this.copyWithFallback(example.code);
      }
      this.copied.set(example.key);
    } catch {
      this.copied.set(null);
    }
  }

  private copyWithFallback(value: string): void {
    if (typeof document === 'undefined') {
      throw new Error('Clipboard unavailable');
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!copied) {
      throw new Error('Copy failed');
    }
  }
}

// The snippets. Kept as plain functions of the endpoint URL so the same body is
// shown whatever the environment the console runs against.

function curlExample(url: string): string {
  return `# Le jeton vient de l'environnement, jamais du code source.
export PUSHIT_TOKEN="apt_..."

curl -X POST "${url}" \\
  -H "X-App-Token: $PUSHIT_TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Hello", "message": "Depuis curl"}'`;
}

function pythonExample(url: string): string {
  return `import os
import uuid

import requests

# Le jeton vient de l'environnement : coller un secret dans un depot est
# le geste qu'on cherche a eviter.
token = os.environ["PUSHIT_TOKEN"]

response = requests.post(
    "${url}",
    headers={
        "X-App-Token": token,
        "Idempotency-Key": str(uuid.uuid4()),
    },
    json={"title": "Hello", "message": "Depuis Python"},
    timeout=10,
)
response.raise_for_status()`;
}

function goExample(url: string): string {
  return `package main

import (
\t"bytes"
\t"log"
\t"net/http"
\t"os"

\t"github.com/google/uuid"
)

func main() {
\t// Le jeton vient de l'environnement, jamais du code source.
\ttoken := os.Getenv("PUSHIT_TOKEN")

\tbody := bytes.NewBufferString(\`{"title":"Hello","message":"Depuis Go"}\`)
\treq, err := http.NewRequest("POST", "${url}", body)
\tif err != nil {
\t\tlog.Fatal(err)
\t}
\treq.Header.Set("X-App-Token", token)
\treq.Header.Set("Idempotency-Key", uuid.NewString())
\treq.Header.Set("Content-Type", "application/json")

\tresp, err := http.DefaultClient.Do(req)
\tif err != nil {
\t\tlog.Fatal(err)
\t}
\tdefer resp.Body.Close()
\tlog.Println(resp.Status)
}`;
}

function rubyExample(url: string): string {
  return `require "json"
require "net/http"
require "securerandom"
require "uri"

# Le jeton vient de l'environnement, jamais du code source.
token = ENV.fetch("PUSHIT_TOKEN")

uri = URI("${url}")
request = Net::HTTP::Post.new(uri)
request["X-App-Token"] = token
request["Idempotency-Key"] = SecureRandom.uuid
request["Content-Type"] = "application/json"
request.body = JSON.dump(title: "Hello", message: "Depuis Ruby")

response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == "https") do |http|
  http.request(request)
end
puts response.code`;
}

function javaExample(url: string): string {
  return `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

public class SendNotification {
    public static void main(String[] args) throws Exception {
        // Le jeton vient de l'environnement, jamais du code source.
        String token = System.getenv("PUSHIT_TOKEN");

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("${url}"))
                .header("X-App-Token", token)
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        "{\\"title\\":\\"Hello\\",\\"message\\":\\"Depuis Java\\"}"))
                .build();

        HttpResponse<String> response = HttpClient.newHttpClient()
                .send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.statusCode());
    }
}`;
}

function cExample(url: string): string {
  return `/* gcc send.c -lcurl -o send */
#include <stdio.h>
#include <stdlib.h>
#include <curl/curl.h>

int main(void) {
    /* Le jeton vient de l'environnement, jamais du code source. */
    const char *token = getenv("PUSHIT_TOKEN");
    if (!token) {
        fprintf(stderr, "PUSHIT_TOKEN manquant\\n");
        return 1;
    }

    char app_token_header[256];
    snprintf(app_token_header, sizeof(app_token_header), "X-App-Token: %s", token);

    CURL *curl = curl_easy_init();
    if (!curl) return 1;

    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, app_token_header);
    headers = curl_slist_append(headers, "Idempotency-Key: 6f1e2c34-0000-4000-8000-000000000001");
    headers = curl_slist_append(headers, "Content-Type: application/json");

    curl_easy_setopt(curl, CURLOPT_URL, "${url}");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS,
                     "{\\"title\\":\\"Hello\\",\\"message\\":\\"Depuis C\\"}");

    CURLcode res = curl_easy_perform(curl);
    if (res != CURLE_OK) fprintf(stderr, "%s\\n", curl_easy_strerror(res));

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    return res == CURLE_OK ? 0 : 1;
}`;
}

function cppExample(url: string): string {
  return `// g++ -std=c++17 send.cpp -lcurl -o send
#include <cstdlib>
#include <iostream>
#include <string>
#include <curl/curl.h>

int main() {
    // Le jeton vient de l'environnement, jamais du code source.
    const char *env = std::getenv("PUSHIT_TOKEN");
    if (env == nullptr) {
        std::cerr << "PUSHIT_TOKEN manquant" << std::endl;
        return 1;
    }
    const std::string header = "X-App-Token: " + std::string(env);

    CURL *curl = curl_easy_init();
    if (curl == nullptr) return 1;

    curl_slist *headers = nullptr;
    headers = curl_slist_append(headers, header.c_str());
    headers = curl_slist_append(headers, "Idempotency-Key: 6f1e2c34-0000-4000-8000-000000000002");
    headers = curl_slist_append(headers, "Content-Type: application/json");

    const std::string body = R"({"title":"Hello","message":"Depuis C++"})";
    curl_easy_setopt(curl, CURLOPT_URL, "${url}");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());

    const CURLcode res = curl_easy_perform(curl);
    if (res != CURLE_OK) std::cerr << curl_easy_strerror(res) << std::endl;

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    return res == CURLE_OK ? 0 : 1;
}`;
}

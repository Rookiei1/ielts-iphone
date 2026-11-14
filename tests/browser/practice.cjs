const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..", "build", "web");
const shots = path.join(__dirname, "..", "..", "docs", "screenshots");

function serve(port) {
  const server = http.createServer((request, response) => {
    const url = decodeURIComponent((request.url || "/").split("?")[0]);
    const file = path.normalize(path.join(root, url === "/" ? "index.html" : url));
    if (!file.startsWith(root)) { response.writeHead(403); response.end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404); response.end("missing"); return; }
      response.writeHead(200); response.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

async function acceptLicense(page) {
  const button = page.getByRole("button", { name: "我已了解" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

async function answerHarbor(popup) {
  await popup.locator("#q1_input").fill("shed");
  await popup.locator("#q2_input").fill("lantern");
  await popup.locator("#q3_input").fill("cedar");
  await popup.locator('input[name="q4"][value="TRUE"]').check();
  await popup.locator('input[name="q5"][value="FALSE"]').check();
  await popup.locator('input[name="q6"][value="NOT GIVEN"]').check();
  await popup.locator("#submit-btn").click();
  await popup.getByText("得分 6 / 6").waitFor({ timeout: 15000 });
  const articleBtn = popup.getByRole("button", { name: "文章" });
  if (await articleBtn.isVisible().catch(() => false)) {
    await articleBtn.click();
  }
  await popup.getByText("原创解析：笔记放在码头边的棚屋里").waitFor({ timeout: 15000 });
  const questionsBtn = popup.getByRole("button", { name: "题目" });
  if (await questionsBtn.isVisible().catch(() => false)) {
    await questionsBtn.click();
  }
  await popup.locator("#submit-btn").click({ timeout: 3000 }).catch(() => {});
}

function findChromiumExecutable() {
  if (process.env.PLAYWRIGHT_CHROME_PATH && fs.existsSync(process.env.PLAYWRIGHT_CHROME_PATH)) {
    return process.env.PLAYWRIGHT_CHROME_PATH;
  }
  const bundled = chromium.executablePath();
  if (bundled && fs.existsSync(bundled)) return undefined;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ];
  return candidates.find((p) => fs.existsSync(p));
}

async function main() {
  fs.mkdirSync(shots, { recursive: true });
  const server = await serve(8765);
  const executablePath = findChromiumExecutable();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const failures = [];
  page.on("pageerror", (error) => failures.push(String(error)));
  try {
    await page.goto("http://127.0.0.1:8765/");
    await page.getByText("Harbor Notebook").waitFor();
    const title = await page.title();
    if (title !== "雅思练习") throw new Error(`unexpected title: ${title}`);
    const bodyText = await page.locator("body").innerText();
    for (const forbidden of ["ZYZ", "小红书", "Salloway", "IELTS Atlas"]) {
      if (bodyText.includes(forbidden)) throw new Error(`unexpected branding text: ${forbidden}`);
    }
    if ((await page.locator("#license-modal").count()) !== 0) throw new Error("license modal should be removed");
    const navBox = await page.locator(".main-nav").boundingBox();
    if (!navBox || navBox.height > 80) throw new Error(`nav bar too tall on iPhone: ${navBox && navBox.height}`);
    const libraryBarText = await page.locator("#iphone-bar").innerText();
    if (libraryBarText.includes("文章") || libraryBarText.includes("题目")) {
      throw new Error(`library bar should not show practice controls: ${libraryBarText}`);
    }
    await page.screenshot({ path: path.join(shots, "iphone-library.png") });
    await page.setViewportSize({ width: 430, height: 932 });
    await page.screenshot({ path: path.join(shots, "iphone-library-regular.png") });
    await page.setViewportSize({ width: 390, height: 844 });

    const harbor = page.locator(".exam-item", { hasText: "Harbor Notebook" });
    const popupPromise = page.waitForEvent("popup");
    await harbor.getByRole("button", { name: "开始练习" }).click();
    const popup = await popupPromise;
    await popup.locator("#q1_input").waitFor();
    if ((await popup.opener()) !== page) throw new Error("practice window lost its opener");
    const submitBox = await popup.locator("#submit-btn").boundingBox();
    const barBox = await popup.locator("#iphone-bar").boundingBox();
    if (!submitBox || !barBox || submitBox.y + submitBox.height > barBox.y + 1) {
      throw new Error(`submit button overlapped by iphone-bar: submit=${JSON.stringify(submitBox)} bar=${JSON.stringify(barBox)}`);
    }
    await popup.getByRole("button", { name: "文章" }).click();
    await popup.locator("#left").evaluate((node) => { node.scrollTop = 240; });
    await popup.getByRole("button", { name: "题目" }).click();
    await popup.getByRole("button", { name: "文章" }).click();
    const scroll = await popup.locator("#left").evaluate((node) => node.scrollTop);
    if (scroll < 200) throw new Error(`passage scroll position was not kept: ${scroll}`);
    await popup.getByRole("button", { name: "题目" }).click();
    await popup.screenshot({ path: path.join(shots, "iphone-practice.png") });
    await answerHarbor(popup);
    await popup.screenshot({ path: path.join(shots, "iphone-result.png") });
    await popup.close();

    const records = await page.evaluate(async () => window.AppData.practice.list({ projection: "light" }));
    const harborRecords = records.filter((record) => String(record.examId) === "sample-harbor");
    if (harborRecords.length !== 1) throw new Error(`expected one harbor record, got ${harborRecords.length}`);

    const loft = page.locator(".exam-item", { hasText: "Glass Loft" });
    const loftPromise = page.waitForEvent("popup");
    await loft.getByRole("button", { name: "开始练习" }).click();
    const loftPage = await loftPromise;
    await loftPage.locator(".drag-item", { hasText: "loft" }).click();
    await loftPage.locator('.match-dropzone[data-question="q1"]').click();
    await loftPage.locator(".drag-item", { hasText: "shed" }).click();
    await loftPage.locator('.match-dropzone[data-question="q2"]').click();
    await loftPage.locator("#submit-btn").click();
    await loftPage.getByText("得分 2 / 2").waitFor();
    await loftPage.close();

    await page.getByRole("button", { name: /练习记录/ }).click();
    await page.locator("#practice-view").getByText("Harbor Notebook").waitFor();
    await page.getByRole("button", { name: /数据设置/ }).click();
    await page.locator("#settings-view").waitFor({ state: "visible" });
    const json = await page.evaluate(async () => window.practiceRecorder.exportData("json"));
    const imported = await page.evaluate(async (value) => {
      await window.AppData.practice.list();
      return window.practiceRecorder.importData(JSON.parse(value), { merge: true });
    }, json);
    if (!imported || imported.committed !== true) throw new Error("learning data import was not committed");
    const after = await page.evaluate(async () => (await window.AppData.practice.list({ projection: "light" })).length);
    const before = records.length + 1;
    if (after !== before) throw new Error(`import duplicated records: before ${before}, after ${after}`);
    if (failures.length) throw new Error(failures.join("\n"));
    console.log("browser practice flow passed");
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

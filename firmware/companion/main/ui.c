#include "ui.h"

#include <stdio.h>
#include <string.h>

#include "bsp/esp-bsp.h"
#include "esp_log.h"
#include "lvgl.h"

static const char *TAG = "wa-ui";

#define COLOR_PINE 0x071417
#define COLOR_AMBER 0xD4A373
#define COLOR_WHITE 0xFFFFFF
#define COLOR_MUTED 0xA0A0A0
#define COLOR_OK 0x4ADE80
#define COLOR_BAD 0xEF4444

static lv_obj_t *s_boot;
static lv_obj_t *s_setup;
static lv_obj_t *s_home;
static lv_obj_t *s_boot_status;
static lv_obj_t *s_setup_detail;
static lv_obj_t *s_home_status;
static lv_obj_t *s_home_tailnet;
static lv_obj_t *s_home_reply;
static lv_obj_t *s_home_dot;
static ui_call_cb_t s_call_cb;

static void load_screen(lv_obj_t *screen)
{
#if LVGL_VERSION_MAJOR >= 9
    lv_screen_load(screen);
#else
    lv_scr_load(screen);
#endif
}

static lv_obj_t *make_screen(void)
{
    lv_obj_t *screen = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(screen, lv_color_hex(COLOR_PINE), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(screen, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_clear_flag(screen, LV_OBJ_FLAG_SCROLLABLE);
    return screen;
}

static lv_obj_t *make_label(lv_obj_t *parent, const char *text, uint32_t color, const lv_font_t *font)
{
    lv_obj_t *label = lv_label_create(parent);
    lv_label_set_text(label, text);
    lv_obj_set_style_text_color(label, lv_color_hex(color), LV_PART_MAIN);
    if (font) {
        lv_obj_set_style_text_font(label, font, LV_PART_MAIN);
    }
    return label;
}

static void call_clicked(lv_event_t *event)
{
    (void)event;
    if (s_call_cb) {
        s_call_cb();
    }
}

static void build_boot(void)
{
    s_boot = make_screen();
    lv_obj_t *wordmark = make_label(s_boot, "WorkspaceAlberta", COLOR_AMBER, &lv_font_montserrat_24);
    lv_obj_align(wordmark, LV_ALIGN_TOP_MID, 0, 72);

    lv_obj_t *sub = make_label(s_boot, "Companion experiment", COLOR_WHITE, &lv_font_montserrat_14);
    lv_obj_align(sub, LV_ALIGN_TOP_MID, 0, 112);

    lv_obj_t *bar = lv_obj_create(s_boot);
    lv_obj_set_size(bar, 160, 6);
    lv_obj_set_style_bg_color(bar, lv_color_hex(COLOR_AMBER), LV_PART_MAIN);
    lv_obj_set_style_border_width(bar, 0, LV_PART_MAIN);
    lv_obj_set_style_radius(bar, 3, LV_PART_MAIN);
    lv_obj_align(bar, LV_ALIGN_TOP_MID, 0, 148);

    s_boot_status = make_label(s_boot, "Starting…", COLOR_MUTED, &lv_font_montserrat_14);
    lv_label_set_long_mode(s_boot_status, LV_LABEL_LONG_WRAP);
    lv_obj_set_width(s_boot_status, 300);
    lv_obj_set_style_text_align(s_boot_status, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN);
    lv_obj_align(s_boot_status, LV_ALIGN_CENTER, 0, 40);
}

static void build_setup(void)
{
    s_setup = make_screen();
    lv_obj_t *title = make_label(s_setup, "First-run setup", COLOR_AMBER, &lv_font_montserrat_24);
    lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 28);

    lv_obj_t *body = make_label(
        s_setup,
        "1. Join WiFi  WA-Companion\n"
        "2. Open  http://192.168.4.1\n"
        "3. Enter wifi_pass + Tailscale\n"
        "   auth key (on-device only)\n"
        "4. Or serial: set wifi_pass …\n"
        "   set ts_auth_key …  save",
        COLOR_WHITE,
        &lv_font_montserrat_14);
    lv_label_set_long_mode(body, LV_LABEL_LONG_WRAP);
    lv_obj_set_width(body, 320);
    lv_obj_align(body, LV_ALIGN_TOP_LEFT, 24, 80);

    s_setup_detail = make_label(s_setup, "", COLOR_MUTED, &lv_font_montserrat_14);
    lv_obj_align(s_setup_detail, LV_ALIGN_BOTTOM_MID, 0, -24);
}

static void build_home(void)
{
    s_home = make_screen();

    lv_obj_t *title = make_label(s_home, "Companion", COLOR_AMBER, &lv_font_montserrat_24);
    lv_obj_align(title, LV_ALIGN_TOP_LEFT, 20, 16);

    s_home_dot = lv_obj_create(s_home);
    lv_obj_set_size(s_home_dot, 14, 14);
    lv_obj_set_style_radius(s_home_dot, LV_RADIUS_CIRCLE, LV_PART_MAIN);
    lv_obj_set_style_border_width(s_home_dot, 0, LV_PART_MAIN);
    lv_obj_set_style_bg_color(s_home_dot, lv_color_hex(COLOR_MUTED), LV_PART_MAIN);
    lv_obj_align(s_home_dot, LV_ALIGN_TOP_RIGHT, -20, 24);

    s_home_status = make_label(s_home, "Waiting…", COLOR_MUTED, &lv_font_montserrat_14);
    lv_label_set_long_mode(s_home_status, LV_LABEL_LONG_WRAP);
    lv_obj_set_width(s_home_status, 328);
    lv_obj_align(s_home_status, LV_ALIGN_TOP_LEFT, 20, 52);

    s_home_tailnet = make_label(s_home, "Tailscale: starting…", COLOR_AMBER, &lv_font_montserrat_14);
    lv_label_set_long_mode(s_home_tailnet, LV_LABEL_LONG_WRAP);
    lv_obj_set_width(s_home_tailnet, 328);
    lv_obj_align(s_home_tailnet, LV_ALIGN_TOP_LEFT, 20, 80);

    lv_obj_t *card = lv_obj_create(s_home);
    lv_obj_set_size(card, 328, 148);
    lv_obj_align(card, LV_ALIGN_TOP_MID, 0, 118);
    lv_obj_set_style_bg_color(card, lv_color_hex(0x0C1C20), LV_PART_MAIN);
    lv_obj_set_style_border_color(card, lv_color_hex(COLOR_AMBER), LV_PART_MAIN);
    lv_obj_set_style_border_width(card, 1, LV_PART_MAIN);
    lv_obj_set_style_radius(card, 12, LV_PART_MAIN);
    lv_obj_set_style_pad_all(card, 12, LV_PART_MAIN);
    lv_obj_clear_flag(card, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *hint = make_label(card, "Last Pi reply", COLOR_AMBER, &lv_font_montserrat_14);
    lv_obj_align(hint, LV_ALIGN_TOP_LEFT, 0, 0);

    s_home_reply = make_label(card, "Tap Call Pi to send a ping.", COLOR_WHITE, &lv_font_montserrat_14);
    lv_label_set_long_mode(s_home_reply, LV_LABEL_LONG_WRAP);
    lv_obj_set_width(s_home_reply, 292);
    lv_obj_align(s_home_reply, LV_ALIGN_TOP_LEFT, 0, 28);

    lv_obj_t *btn = lv_button_create(s_home);
    lv_obj_set_size(btn, 328, 80);
    lv_obj_align(btn, LV_ALIGN_BOTTOM_MID, 0, -24);
    lv_obj_set_style_bg_color(btn, lv_color_hex(COLOR_AMBER), LV_PART_MAIN);
    lv_obj_set_style_radius(btn, 16, LV_PART_MAIN);
    lv_obj_add_event_cb(btn, call_clicked, LV_EVENT_CLICKED, NULL);

    lv_obj_t *btn_label = make_label(btn, "Call Pi", COLOR_PINE, &lv_font_montserrat_24);
    lv_obj_center(btn_label);
}

void ui_init(void)
{
    ESP_LOGI(TAG, "starting LVGL via Waveshare BSP (CO5300 / CST820 V2 path)");

    lv_display_t *display = bsp_display_start();
    if (display == NULL) {
        ESP_LOGE(TAG, "bsp_display_start failed — check V2 BSP ^2.0.3");
        return;
    }
    ESP_ERROR_CHECK(bsp_display_brightness_set(80));

    if (!bsp_display_lock(2000)) {
        ESP_LOGE(TAG, "could not lock LVGL");
        return;
    }
    build_boot();
    build_setup();
    build_home();
    load_screen(s_boot);
    bsp_display_unlock();
}

void ui_show_boot(const char *status)
{
    if (!bsp_display_lock(500)) {
        return;
    }
    if (status && s_boot_status) {
        lv_label_set_text(s_boot_status, status);
    }
    if (s_boot) {
        load_screen(s_boot);
    }
    bsp_display_unlock();
}

void ui_show_setup(const char *ap_ssid)
{
    if (!bsp_display_lock(500)) {
        return;
    }
    if (s_setup_detail && ap_ssid) {
        char line[80];
        snprintf(line, sizeof(line), "AP: %s", ap_ssid);
        lv_label_set_text(s_setup_detail, line);
    }
    if (s_setup) {
        load_screen(s_setup);
    }
    bsp_display_unlock();
}

void ui_show_home(void)
{
    if (!bsp_display_lock(500)) {
        return;
    }
    if (s_home) {
        load_screen(s_home);
    }
    bsp_display_unlock();
}

void ui_set_status(const char *status, bool wifi_ok, bool pi_ok)
{
    if (!bsp_display_lock(200)) {
        return;
    }
    if (s_home_status && status) {
        lv_label_set_text(s_home_status, status);
    }
    if (s_home_dot) {
        uint32_t color = COLOR_BAD;
        if (wifi_ok && pi_ok) {
            color = COLOR_OK;
        } else if (wifi_ok) {
            color = COLOR_AMBER;
        }
        lv_obj_set_style_bg_color(s_home_dot, lv_color_hex(color), LV_PART_MAIN);
    }
    bsp_display_unlock();
}

void ui_set_tailnet(const char *line)
{
    if (!bsp_display_lock(200)) {
        return;
    }
    if (s_home_tailnet && line) {
        lv_label_set_text(s_home_tailnet, line);
    }
    bsp_display_unlock();
}

void ui_set_reply(const char *reply)
{
    if (!bsp_display_lock(200)) {
        return;
    }
    if (s_home_reply && reply) {
        lv_label_set_text(s_home_reply, reply);
    }
    bsp_display_unlock();
}

void ui_set_call_handler(ui_call_cb_t cb)
{
    s_call_cb = cb;
}

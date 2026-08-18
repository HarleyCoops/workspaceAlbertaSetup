#pragma once

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef void (*ui_call_cb_t)(void);

void ui_init(void);
void ui_show_boot(const char *status);
void ui_show_setup(const char *ap_ssid);
void ui_show_home(void);
void ui_set_status(const char *status, bool wifi_ok, bool pi_ok);
void ui_set_tailnet(const char *line);
void ui_set_reply(const char *reply);
void ui_set_call_handler(ui_call_cb_t cb);

#ifdef __cplusplus
}
#endif

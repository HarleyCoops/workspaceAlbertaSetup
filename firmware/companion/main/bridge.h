#pragma once

#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

void bridge_set_targets(const char *ts_host, const char *lan_host, uint16_t port);
esp_err_t bridge_get_health(char *status_out, size_t status_len);
esp_err_t bridge_post_ping(const char *ip, char *reply_out, size_t reply_len);

#ifdef __cplusplus
}
#endif

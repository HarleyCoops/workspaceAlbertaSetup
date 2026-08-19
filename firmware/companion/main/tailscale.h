#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Official MicroLink include path (verified): components/microlink/include/microlink.h */

esp_err_t tailscale_start(const char *auth_key, const char *device_name);
bool tailscale_is_up(void);
void tailscale_get_ip(char *buf, size_t len);
uint32_t tailscale_resolve_pi(void);
void *tailscale_handle(void);

#ifdef __cplusplus
}
#endif

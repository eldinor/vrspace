package org.vrspace.server.api;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.ClientFactory;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.Client;

import lombok.extern.slf4j.Slf4j;

@RestController
@Slf4j
@RequestMapping("/oauth2")
public class Oauth2Controller {
  @Autowired
  VRObjectRepository db;
  @Autowired
  ClientFactory clientFactory;

  @GetMapping("/login")
  public void login(String name, HttpSession session) {
    // at this point client is already authenticated
    if (ObjectUtils.isEmpty(name)) {
      throw new ApiException("Argument required: name");
    }
    log.debug("oauth login as:" + name);
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    String identity = identity((OAuth2AuthenticationToken) authentication);

    Client client = db.getClientByName(name);
    if (client != null) {
      if (client.getIdentity() != null && client.getIdentity().equals(identity)) {
        log.debug("Welcome back: " + name);
      } else {
        throw new ApiException("Someone else uses this name: " + name);
      }
    } else {
      log.debug("Welcome new user: " + name);
      client = new Client(name);
      client.setIdentity(identity);
      client = db.save(client);
    }
    // CHECKME do we need to return anything?
    session.setAttribute(clientFactory.clientAttribute(), name);
  }

  // TODO this should be hashed
  // CHECKME some kind of universal identity
  private String identity(OAuth2AuthenticationToken token) {
    String authority = token.getAuthorizedClientRegistrationId();
    String realName = token.getPrincipal().getAttribute("name");
    return authority + ":" + realName;
  }

  @GetMapping("/callback")
  public void callback(String code, String state, HttpServletRequest request) {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

    OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
    log.debug("oauth callback: code=" + code + " " + oauthToken);
  }
}

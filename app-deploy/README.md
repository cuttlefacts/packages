app-deploy
==================================================

# NAME

  app-deploy

# SYNOPSIS

  kpt pkg get $PKGS/app-deploy myapp/
  # edit myapp/app.yaml
  kpt fn run myapp/
  kubectl apply -f myapp/

# Description

This is a template for deploying an app; it constructs a namespace and
ingress for the app, and adds a sync to the repo given in `app.yaml`.

# SEE ALSO

The `app-build` package has a similar mode of use, and is for adding a
build pipeline for your app (not necessarily in the same cluster as
the app): https://github.com/cuttlefacts/packages/app-build

app-template
==================================================

# NAME

  app-template

# SYNOPSIS

  kpt pkg get $PKGS/app-template my-app
  # edit my-app/app.yaml
  kpt fn run my-app/

# Description

The template is for using the pipelines in the app-harness package for
a particular app. You should `kpt pkg get` it for each app you want to
run; each app will then need its own specific configuration (see the
synopsis).

# SEE ALSO

The app harness has the global definitions used by this package:
https://github.com/cuttlefacts/packages/platform/app-harness

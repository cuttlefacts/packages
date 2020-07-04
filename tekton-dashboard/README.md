tekton-dashboard
==================================================

# NAME

  tekton-dashboard

# SYNOPSIS

  kubectl apply --recursive -f tekton-dashboard

# Description

Base configuration for installing the [Tekton
dashboard](https://github.com/tektoncd/dashboard). Prepared from the
mega-YAML downloaded from the installation docs.

To access it once installed, you will probably need to port-forward:

    kubectl --namespace tekton-pipelines port-forward svc/tekton-dashboard 9097:9097

(substitute the namespace, if you changed it).

# SEE ALSO


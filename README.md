# Cuttlefacts packages

These packages used to build Cuttlefacts configurations.

The tool ./cuttlectl does various operations for you.

**Initialising a configuration repository**

The following snippet initialises a git repo for using as the cluster
configuration.

`hub create` create the project in github, given from local directory;
alternatively, you could go to https://github.com/, create it, then
clone it using its `https` URL.

```bash
$ mkdir cluster1
$ cd cluster1
$ git init
$ git config hub.protocol https # this makes sure the origin URL is https://
$ hub create
```

**Bootstrapping a cluster configuration**

Given a repo cloned from a remote `origin`, this will set up the
cluster given in the default kubectl context to sync to the repo.

```bash
$ cuttlectl bootstrap
```

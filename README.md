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
$ # Method one: hub create
$ mkdir cluster1
$ cd cluster1
$ git init
$ git config hub.protocol https # this makes sure the origin URL is https://
$ hub create
```

```bash
$ # Method two: clone from github
$ #
$ # Create a repo in the GitHub UI: *click click click*
$ #
$ git clone https://github.com/$GITHUB_USERNAME/cluster1.git
$ cd cluster1
```

**Bootstrapping a cluster configuration**

Given a repo cloned from a remote `origin`, this will set up the
cluster given in the default kubectl context to sync to the repo.

The following uses the script in this repo, `cuttlectl`. It mainly
just runs
[`kpt`](https://github.com/GoogleContainerTools/kpt#installation) and
`git` commands so you'll need both of those on the path; you also need
[`fluxctl`](https://github.com/fluxcd/flux/releases) to request syncs.

```bash
$ cuttlectl bootstrap
```

What this actually does:

 1. Get the package `flux-readonly` into `bootstrap/`
 2. Set the git-url argument to the origin of the git repo you're in
 3. Add `bootstrap/` to git
 4. Push to origin
 5. Apply `bootstrap/` to the cluster

You now have a sync (flux deployment) that syncs its own definition --
as well as anything else that you push to the GitHub repository.

As a diagram it looks like this:

```
+-cluster--+   ______
|          |  <______>
|   sync----->|      |<-.
|          |  | boot----'
|          |  \______/
+----------+

("boot" short for bootstrap sync)
```

**Creating a platform for apps**

To host apps in the cluster, it'll need some infrastructure. Later it
can have deployment pipelines and what-not, but for now the thing the
platform is an ingress, so apps can have requests routed to them.

Make a namespace for the platform bits to go in:

```bash
$ mkdir platform
$ cat >> platform/platform-ns.yaml <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: platform-system
EOF
$ git add platform/platform-ns.yaml
$ git commit -m "Create namespace for platform"
```

Now add an ingress controller to it, by getting this package and
making sure it uses the namespace just created:

```bash
$ cuttlectl install nginx-ingress platform/ingress
# ...
$ kpt cfg set platform/ingress namespace platform-system
$ git add platform/ingress
$ git commit -m "Add ingress to platform"
```

Push so it gets synced:

```bash
$ git push origin master
$ cuttlectl sync
```

That last command instructs the sync in the cluster to run right away,
pulling from the origin and applying it to the cluster. Left to
itself, it'll run every few minutes.

With that synced, you should get a response from the cluster on
port 80. If you're running Docker Desktop, that's http://localhost/.

**Onboarding an app**

To run an app on the platform, it needs two things:

 1. the app configuration itself
 2. an ingress (rule) so requests will be routed to it

The package `app-deploy` makes a namespace for the app configuration,
an ingress to route requests to the app, and a sync that pulls in the
app configuration.

The scheme with the app configuration added will look like this:

```
+--cluster-+   ______        ______
|          |  <______>      <______>
|   sync----->|      |<-.   |      |
|          |  | boot----'   | dep  |
|          |  | app-------->| svc  |
|          |  \______/      \______/
+----------+
```

The bootstrap sync refers to a git repo that defines itself; the repo
also defines a sync pointing at the app repo.

This package works differently to the ingress. It gives you a kind of
custom definition `AppDeploy`, which you edit to supply e.g., the git
repo with the app's configuration. Then it's expanded into the YAMLs
for hosting the app in the cluster.

To add an app with the `app-deploy` package:

```bash
$ cuttlectl install app-deploy app
# ...
$ $EDITOR app/app.yaml
```

Replace the values for the name, namespace and the git URL (a value
that will work for the URL is
`https://github.com/cuttlefacts/cuttlefacts-app`). You can also
replace the (routing) prefix, and the service (if you pointed the URL
at cuttlefacts-app, the service name should be `cuttlefacts`).

To do the expansion, run

```bash
$ cuttlectl expand app/
```

This just runs `kpt fn run app/`, which runs a container to generate
YAML files. You can have a look through the resources it generates in
app/; then, add them to git:

```bash
$ git add app
$ git commit -m "Add app to cluster"
$ git push && cuttlectl sync
```

If you check back with the cluster on port 80, you should see the app
deployed under the prefix you gave, for example at (with Docker
Desktop and `/cuttlefacts/`), http://localhost/cuttlefacts/.

If you get `HTTP 404`, then the route may not be what you think it
is. Check with the ingress that was created in the app namespace.

If you get `HTTP 503` that may mean the serviceName is not correct --
check the value in app.yaml against what the app config has (or the
service in the app namespace).

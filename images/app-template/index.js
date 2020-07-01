// Script for generating an app template, given a special "custom
// resource" `app.yaml` (which isn't intended itself for the
// Kubernetes API).
//
// This isn't really a good example of how to make a script to do this
// -- I've just accrued it as I figure out how to construct all the
// things the app template needs.

// Trial run:
//
//     kpt fn source --function-config app.yaml . | jk run ./index.js

import { log, read, print, stdin, Format } from '@jkcfg/std';
import * as resource from '@jkcfg/std/resource';
import { stringify } from '@jkcfg/std';
import { merge } from '@jkcfg/std/merge';

const flatten = Array.prototype.concat.bind([]);
const readYAMLs = f => resource.read(f, { format: Format.YAMLStream });

function mergeReduce(obj, ...mod) {
  return mod.reduce((a, b) => merge(a, b), obj);
}

// Merge strategy for arrays; every value that's in common gets
// merged, overflows are left as-is.
function each(rules) {
  return (a, b) => {
    let result = []
    let i = 0;
    for (; i < a.length; i++) {
      if (i < b.length) {
        result.push(merge(a[i], b[i], rules));
      } else {
        result.push(a[i]);
      }
    }
    if (i < b.length) {
      result = result.concat(b.slice(i));
    }
    return result;
  };
}

function setPath(p, v) {
  let obj = v;
  const segments = p.split('.');
  for (const segment of segments.reverse()) {
    obj = { [segment]: obj };
  }
  return obj;
}

async function main() {
  // we get a ResourceList
  const input = await read(stdin, { format: Format.YAML });

  // config is in the field functionConfig
  const { functionConfig } = input;

  const {
    metadata: { name, namespace },
    spec: { ingress, deploy, image },
  } = functionConfig;

  const files = await Promise.all([
    'namespace.yaml',
    'flux.yaml',
    'ingress.yaml',
    'triggers-serviceaccount.yaml',
    'triggers-clusterrolebinding.yaml',
    'triggers.yaml',
  ].map(readYAMLs));
  // this is sensitive to how the resources are grouped into the
  // files; it would be better to either put one resource per file, or
  // to select from all the resources by name, once read.
  let [ ns, sa, rb, dep, sec, ing, tsa, tcrb, tb, el ] = flatten(...files);

  // modifications for each resource

  const namespacedName = (name, namespace) => ({
    metadata: { name, namespace },
  });

  // this gets used as a name, a lot
  const fluxName = `flux-${name}`;
  const secretName = `${name}-git`;
  // where all the platform (app harness) things live
  const platformNS = 'platform-system';
  const triggersSA = `${name}-sa`;
  const triggersSecret = image.pushSecret;

  // (see the template YAMLs themselves for notes on what goes where
  // and why)
  ns = mergeReduce(ns, { metadata: { name: namespace } });

  sa = mergeReduce(sa, namespacedName(fluxName, platformNS));

  rb = mergeReduce(rb, namespacedName('flux', name), {
    // this field is a list, so merge will in general replace the
    // whole value; it's possible to just merge into a specific entry,
    // but easier here to spell it out.
    subjects: [{ kind: 'ServiceAccount', namespace: platformNS, name: fluxName }],
  });

    // again with a list; it's easier here to construct the whole thing
  // and replace it.
  const fluxContainer = merge(dep.spec.template.spec.containers[0], {
    args: [
      `--k8s-allow-namespace=${namespace}`,
      `--git-url=${deploy.url}`,
      `--git-path=${deploy.path || '.'}`,
      `--git-readonly`,
      `--k8s-secret-name=${secretName}`,
      `--listen-metrics=:3031`,
    `--registry-disable-scanning`,
    ],
  });
  dep = mergeReduce(dep, namespacedName(fluxName, platformNS),
                    setPath('spec.selector.matchLabels.name', fluxName),
                    setPath('spec.template.metadata.labels.name', fluxName),
                    setPath('spec.template.spec.containers', [fluxContainer]),
                    setPath('spec.template.spec.serviceAccountName', fluxName));

  sec = mergeReduce(sec, namespacedName(secretName, platformNS));

  ing = mergeReduce(ing, namespacedName(name, namespace),
                    setPath('metadata.annotations', {
                      'nginx.ingress.kubernetes.io/rewrite-target': ingress.path,
                    }),
                    // these things are a pain
                    setPath('spec.rules', [{
                      http: {
                        paths: [
                          {
                            path: '/', // path at the service
                            backend: {
                              serviceName: ingress.serviceName,
                              servicePort: ingress.servicePort,
                            },
                          },
                        ],
                      },
                    }]));

  tsa = mergeReduce(tsa, namespacedName(triggersSA, platformNS),
                    { secrets: [{ name: triggersSecret }] });

  tcrb = mergeReduce(tcrb, { metadata: { name: `${name}-sa` } }, {
    subjects: [{ kind: 'ServiceAccount', namespace: platformNS, name: triggersSA }],
  });

  tb = mergeReduce(tb, namespacedName(`${name}-push-binding`, platformNS), {
    spec: {
      params: [
        { name: 'gitrepositoryurl', value: image.url },
        { name: 'dockerfile', value: image.dockerfilePath },
        { name: 'path', value: image.path },
        { name: 'imagename', value: `${image.repo}:$(body.head_commit.id)` }, // NB embedded template
        { name: 'serviceaccount', value: triggersSA },
      ],
    },
  });

  const triggers = merge(el.spec.triggers, [{
    name: 'master-merge',
    interceptors: [{
      github: {
        secretRef: {
          secretName: `${name}-github-secret`,
        },
      },
    }],
    bindings: [
      { name: 'github-push-binding' }, // defined in app-harness
      { name: tb.metadata.name }, // i.e., defined just above
    ],
  }], each({
    interceptors: each(),
  }));

  el = mergeReduce(el, namespacedName(`${name}-merge-listener`, platformNS), {
    spec: {
      serviceAccountName: triggersSA,
      triggers,
    },
  });

  const items = [ ns, sa, rb, dep, sec, ing, tsa, tcrb, tb, el ];
  for (const original of input.items) {
    // NB this assumes that _if_ the function config came from here,
    // there's only one of them.
    if (original.kind == functionConfig.kind && original.name == functionConfig.name) {
      items.push(original);
      break;
    }
  }

  print({
    apiVersion: 'config.kubernetes.io/v1alpha1',
    kind: 'ResourceList',
    items,
  }, { format: Format.YAML });
}

main();

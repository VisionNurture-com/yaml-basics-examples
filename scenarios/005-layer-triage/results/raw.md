# 005-layer-triage 生ログ（2026-09-06T11:28:31.898Z / darwin arm64）

道具: yamllint 1.38.0 / actionlint 1.7.12 / dclint 3.1.0 / js-yaml 5.4.1

## layer1-ci.yml
- yamllint rc=1 ids=["trailing-spaces"]
- actionlint ids=[]
- dclint caught=false ids=[]
- docker compose config -q rc=null

## layer2-ci.yml
- yamllint rc=0 ids=[]
- actionlint ids=["deprecated-commands","expression","runner-label"]
- dclint caught=false ids=[]
- docker compose config -q rc=null

## layer2-compose.yaml
- yamllint rc=0 ids=[]
- actionlint ids=[]
- dclint caught=true ids=["invalid-schema"]
- docker compose config -q rc=1

## layer3-ci.yml
- yamllint rc=0 ids=["truthy"]
- actionlint ids=[]
- dclint caught=false ids=[]
- docker compose config -q rc=null

## layer4-ci.yml
- yamllint rc=0 ids=[]
- actionlint ids=[]
- dclint caught=false ids=[]
- docker compose config -q rc=null

## layer2-compose-style.yaml
- yamllint rc=0 ids=[]
- actionlint ids=[]
- dclint caught=true ids=["no-unbound-port-interfaces","require-project-name-field","require-quotes-in-ports","services-alphabetical-order"]
- docker compose config -q rc=0

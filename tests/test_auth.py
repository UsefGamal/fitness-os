def test_login_wrong_password_rejected(client):
    r = client.post("/login", data={"password": "nope"})
    assert r.status_code == 401
    assert "Wrong password" in r.text


def test_login_correct_password_redirects_home(client, test_password):
    r = client.post("/login", data={"password": test_password}, follow_redirects=False)
    assert r.status_code == 303
    assert r.headers["location"] == "/"


def test_protected_route_redirects_when_logged_out(client):
    r = client.get("/", follow_redirects=False)
    assert r.status_code == 303
    assert r.headers["location"] == "/login"


def test_protected_route_accessible_once_logged_in(auth_client):
    r = auth_client.get("/")
    assert r.status_code == 200


def test_logout_clears_session(auth_client):
    assert auth_client.get("/").status_code == 200
    auth_client.get("/logout")
    r = auth_client.get("/", follow_redirects=False)
    assert r.status_code == 303
    assert r.headers["location"] == "/login"


def test_login_rate_limited_after_five_failures(client):
    for _ in range(5):
        r = client.post("/login", data={"password": "wrong"})
        assert r.status_code == 401
    r = client.post("/login", data={"password": "wrong"})
    assert r.status_code == 429
    assert "Too many attempts" in r.text


def test_login_locked_out_even_with_correct_password(client, test_password):
    for _ in range(5):
        client.post("/login", data={"password": "wrong"})
    r = client.post("/login", data={"password": test_password}, follow_redirects=False)
    assert r.status_code == 429


def test_successful_login_clears_rate_limit_counter(client, test_password):
    for _ in range(4):
        client.post("/login", data={"password": "wrong"})
    r = client.post("/login", data={"password": test_password}, follow_redirects=False)
    assert r.status_code == 303
    # counter should be clear now — a subsequent single failure shouldn't lock out
    r = client.post("/login", data={"password": "wrong"})
    assert r.status_code == 401
